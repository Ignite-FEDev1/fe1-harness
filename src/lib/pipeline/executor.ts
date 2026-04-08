import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

import { setActiveQuery, removeActiveQuery, isSessionStopped, clearStopFlag } from './active-queries';
import { pipelineEventBus } from './event-bus';
import {
  parseProgress,
  parseStageIds,
  detectUserGate,
  detectAbort,
  detectCompletion,
  extractUserGatePrompt,
} from './progress-parser';
import { createServerClient } from '../supabase/server';

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
}

interface SDKMessage {
  type: string;
  subtype?: string;
  message?: {
    role?: string;
    content?: ContentBlock[];
  };
  is_error?: boolean;
  total_cost_usd?: number;
  num_turns?: number;
  session_id?: string;
}

function extractTextFromMessage(message: SDKMessage): string {
  const blocks = message.message?.content ?? [];
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'text' && block.text) {
      parts.push(block.text);
    } else if (block.type === 'tool_use' && block.name) {
      const summary = summarizeToolInput(block.name, block.input ?? {});
      parts.push(`[도구] ${block.name}: ${summary}`);
    }
  }

  return parts.join('\n');
}

function summarizeToolInput(
  name: string,
  input: Record<string, unknown>,
): string {
  switch (name) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return String(input.file_path ?? '');
    case 'Bash':
      return String(input.command ?? '').slice(0, 200);
    case 'WebFetch':
      return String(input.url ?? '');
    case 'Grep': {
      const pattern = String(input.pattern ?? '');
      const inPath = input.path ? ` in ${String(input.path)}` : '';
      return `"${pattern}"${inPath}`;
    }
    case 'Glob':
      return `${String(input.pattern ?? '')}${input.path ? ` in ${String(input.path)}` : ''}`;
    case 'Agent': {
      const desc = String(input.description ?? '');
      return desc;
    }
    default:
      return JSON.stringify(input).slice(0, 200);
  }
}

function extractToolResults(message: SDKMessage): string {
  const blocks = message.message?.content ?? [];
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type !== 'tool_result') continue;
    const contents = Array.isArray(block.content) ? block.content : [];
    for (const c of contents) {
      if (!c || typeof c !== 'object') continue;
      const item = c as { type?: string; text?: string };
      if (item.type === 'text' && item.text) {
        const lines = item.text.split('\n').slice(0, 10);
        parts.push(`[도구 결과]\n${lines.join('\n')}`);
      }
    }
  }

  return parts.join('\n');
}

// H-Chat (claude-h) 환경 설정
// 가이드 기준 26.4.7 이후 구 URL(/claude-code) 차단 → /claude-code/v2 사용
const H_CHAT_CONFIG = {
  ANTHROPIC_BASE_URL: 'https://h-chat-api.autoever.com/claude-code/v2',
  API_TIMEOUT_MS: '3000000',
  DISABLE_AUTOUPDATER: '1',
};

export type ApiMode = 'h-chat' | 'claude-max';

export function resolveApiMode(envVars: Record<string, string>): ApiMode {
  if (envVars.H_CHAT_TOKEN) return 'h-chat';
  // Fallback: use local Claude Code OAuth session (~/.claude/)
  return 'claude-max';
}

// Default models per API mode
const DEFAULT_MODEL_BY_MODE: Record<ApiMode, string> = {
  'h-chat':     'claude-sonnet-4-6',
  'claude-max': 'claude-opus-4-6',
};

// H-Chat only supports these models (no opus)
const H_CHAT_ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
]);

export async function executePipeline(options: {
  sessionId: string;
  docsDir: string;
  harnessRoot: string;
  envVars: Record<string, string>;
  apiMode?: ApiMode;
  model?: string;
  projectSlug?: string;
  taskType?: string;
  genericPipeline?: string;
  specialRule?: string;
  notes?: string;
}) {
  const { sessionId, docsDir, harnessRoot, envVars, model: requestedModel } = options;
  const supabase = createServerClient();

  // Determine API mode: respect explicit override if valid, else auto-detect
  let apiMode: ApiMode;
  if (options.apiMode === 'h-chat' && envVars.H_CHAT_TOKEN) {
    apiMode = 'h-chat';
  } else if (options.apiMode === 'claude-max') {
    apiMode = 'claude-max';
  } else {
    apiMode = resolveApiMode(envVars);
  }

  // Build environment based on API mode
  const sdkEnv: Record<string, string | undefined> = { ...process.env, ...envVars };

  if (apiMode === 'h-chat') {
    // H-Chat: 가이드 settings.json 방식과 동일하게 ANTHROPIC_AUTH_TOKEN 사용
    // ANTHROPIC_API_KEY도 함께 설정 (SDK 버전에 따라 다르게 읽을 수 있음)
    sdkEnv.ANTHROPIC_AUTH_TOKEN = envVars.H_CHAT_TOKEN;
    sdkEnv.ANTHROPIC_API_KEY = envVars.H_CHAT_TOKEN;
    sdkEnv.ANTHROPIC_BASE_URL = H_CHAT_CONFIG.ANTHROPIC_BASE_URL;
    sdkEnv.API_TIMEOUT_MS = H_CHAT_CONFIG.API_TIMEOUT_MS;
    sdkEnv.DISABLE_AUTOUPDATER = H_CHAT_CONFIG.DISABLE_AUTOUPDATER;
    // CLAUDE_CONFIG_DIR 미사용: ~/.claude-h/settings.json에 한글 플레이스홀더 → ByteString 에러
  } else if (apiMode === 'claude-max') {
    // Claude Max: API 키 주입 없이 ~/.claude/ OAuth 세션 그대로 사용
    delete sdkEnv.ANTHROPIC_API_KEY;
    delete sdkEnv.ANTHROPIC_BASE_URL;
  }

  // Determine prompt:
  // - If genericPipeline or projectSlug+taskType → orchestrator.md (dynamic pipeline)
  // - Otherwise → use notes directly as prompt (no pipeline)
  const useOrchestrator = !!(options.genericPipeline || options.specialRule || (options.projectSlug && options.taskType));

  let prompt: string;
  if (useOrchestrator) {
    const orchestratorMd = readFileSync(
      path.join(harnessRoot, '.claude/commands/orchestrator.md'),
      'utf-8',
    );
    const frontmatterEnd = orchestratorMd.indexOf('---', orchestratorMd.indexOf('---') + 3);
    const promptBody =
      frontmatterEnd !== -1
        ? orchestratorMd.slice(frontmatterEnd + 3).trim()
        : orchestratorMd;
    prompt = promptBody.replace(/\$ARGUMENTS/g, docsDir);
  } else {
    // Notes-only mode: run the user's request directly without a pipeline wrapper
    prompt = options.notes?.trim() ?? '작업 내용이 없습니다.';
  }

  // Update session status to running
  await supabase
    .from('sessions')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  pipelineEventBus.emit(sessionId, 'status', { status: 'running' });
  pipelineEventBus.emit(sessionId, 'log', {
    content: `[시스템] API 모드: ${{ 'h-chat': 'H-Chat (회사 내부)', 'claude-max': 'Claude Max (로컬 OAuth)' }[apiMode]}`,
    timestamp: new Date().toISOString(),
  });

  // Immediately highlight "작업 준비" stage — don't wait for orchestrator output
  if (useOrchestrator) {
    pipelineEventBus.emit(sessionId, 'progress', { stageId: 'init' });
    await supabase.from('session_logs').insert({
      session_id: sessionId,
      content: JSON.stringify({ stageId: 'init' }),
      event_type: 'progress',
    });
  }

  try {
    const q = query({
      prompt,
      options: {
        cwd: harnessRoot,
        env: sdkEnv,
        allowedTools: [
          'Read',
          'Glob',
          'Grep',
          'Bash',
          'Agent',
          'Write',
          'Edit',
          'WebFetch',
          'mcp__Framelink-MCP-for-Figma__get_figma_data',
          'mcp__Framelink-MCP-for-Figma__download_figma_images',
        ],
        permissionMode: 'bypassPermissions',
        // Resolve model: use requested model, but guard H-Chat against unsupported models
        model: (() => {
          const fallback = DEFAULT_MODEL_BY_MODE[apiMode];
          if (!requestedModel) return fallback;
          if (apiMode === 'h-chat' && !H_CHAT_ALLOWED_MODELS.has(requestedModel)) {
            console.warn(`[executor] H-Chat does not support ${requestedModel}, falling back to ${fallback}`);
            return fallback;
          }
          return requestedModel;
        })(),
      },
    });

    // Store query object for User Gate streamInput
    setActiveQuery(sessionId, q);

    let accumulatedText = '';
    let totalCost: number | undefined;
    let totalTurns: number | undefined;
    let claudeSessionIdValue: string | undefined;

    for await (const message of q) {
      const sdkMsg = message as unknown as SDKMessage;
      let content = '';

      if (sdkMsg.type === 'assistant') {
        content = extractTextFromMessage(sdkMsg);
      } else if (sdkMsg.type === 'user') {
        content = extractToolResults(sdkMsg);
      } else if (sdkMsg.type === 'result') {
        if (sdkMsg.is_error) {
          content = `[완료] 실패`;
        } else {
          const cost = sdkMsg.total_cost_usd;
          content = `[완료] 성공 (${cost != null ? `$${cost.toFixed(4)}` : '비용 미제공'}, ${sdkMsg.num_turns ?? 0}턴)`;
          totalCost = cost;
          totalTurns = sdkMsg.num_turns;
        }
        // Save Claude session ID so users can resume in CLI
        if (sdkMsg.session_id) {
          claudeSessionIdValue = sdkMsg.session_id;
          await supabase
            .from('sessions')
            .update({ claude_session_id: sdkMsg.session_id })
            .eq('id', sessionId);
          pipelineEventBus.emit(sessionId, 'claude_session_id', { claudeSessionId: sdkMsg.session_id });
        }
      }

      if (!content.trim()) continue;

      accumulatedText += content + '\n';

      // Emit log event
      const timestamp = new Date().toISOString();
      pipelineEventBus.emit(sessionId, 'log', { content, timestamp });

      // Save log to DB
      await supabase.from('session_logs').insert({
        session_id: sessionId,
        content,
        event_type: 'log',
      });

      // Check for stage progress markers (new orchestrator: 📍 [stage-id])
      // A single message may contain multiple markers (e.g. init + summary + translate)
      const stageIds = parseStageIds(content);
      for (const stageId of stageIds) {
        pipelineEventBus.emit(sessionId, 'progress', { stageId });
        await supabase.from('session_logs').insert({
          session_id: sessionId,
          content: JSON.stringify({ stageId }),
          event_type: 'progress',
        });
      }

      // Check for legacy step markers (old pipeline.md: 📍 [STEP N/4])
      const legacyProgress = parseProgress(content);
      if (legacyProgress) {
        pipelineEventBus.emit(sessionId, 'progress', legacyProgress);
        await supabase
          .from('sessions')
          .update({
            current_step: legacyProgress.step,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        await supabase.from('session_logs').insert({
          session_id: sessionId,
          content: JSON.stringify(legacyProgress),
          event_type: 'progress',
        });
      }

      // Check if stop was requested
      if (isSessionStopped(sessionId)) {
        clearStopFlag(sessionId);
        await supabase
          .from('sessions')
          .update({ status: 'stopped', updated_at: new Date().toISOString() })
          .eq('id', sessionId);
        pipelineEventBus.emit(sessionId, 'status', { status: 'stopped' });
        pipelineEventBus.emit(sessionId, 'done', {});
        return;
      }

      // Check for User Gate
      if (detectUserGate(content)) {
        const gatePrompt = extractUserGatePrompt(content);
        pipelineEventBus.emit(sessionId, 'usergate', {
          prompt: gatePrompt,
        });
        await supabase
          .from('sessions')
          .update({ status: 'paused', updated_at: new Date().toISOString() })
          .eq('id', sessionId);
        pipelineEventBus.emit(sessionId, 'status', { status: 'paused' });

        await supabase.from('session_logs').insert({
          session_id: sessionId,
          content: gatePrompt,
          event_type: 'usergate',
        });
      }

      // Check for abort
      if (detectAbort(content)) {
        await supabase
          .from('sessions')
          .update({
            status: 'error',
            error_message: content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
        pipelineEventBus.emit(sessionId, 'status', {
          status: 'error',
          error: content,
        });
      }

      // Check for completion
      if (detectCompletion(content)) {
        await supabase
          .from('sessions')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
        pipelineEventBus.emit(sessionId, 'status', { status: 'completed' });
      }
    }

    // Pipeline finished - ensure status is set
    const { data: session } = await supabase
      .from('sessions')
      .select('status')
      .eq('id', sessionId)
      .single();

    if (session?.status === 'running') {
      await supabase
        .from('sessions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      pipelineEventBus.emit(sessionId, 'status', { status: 'completed' });
    }

    // Update meta.json with execution results
    const metaPath = path.join(docsDir, 'meta.json');
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
        meta.completed_at = new Date().toISOString();
        meta.cost_usd = totalCost;
        meta.turns = totalTurns;
        meta.claude_session_id = claudeSessionIdValue;
        meta.status = session?.status ?? 'completed';
        writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
      } catch { /* ignore meta update failure */ }
    }

    pipelineEventBus.emit(sessionId, 'done', {});
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    await supabase
      .from('sessions')
      .update({
        status: 'error',
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
    pipelineEventBus.emit(sessionId, 'status', {
      status: 'error',
      error: errorMessage,
    });
    pipelineEventBus.emit(sessionId, 'done', {});
  } finally {
    removeActiveQuery(sessionId);

    // Clean up git worktree created during develop stage
    // The worktree is at {docsDir}/worktree — remove it so the branch is unlocked
    const worktreePath = path.join(docsDir, 'worktree');
    try {
      const { existsSync } = await import('fs');
      if (existsSync(worktreePath)) {
        // Get the main repo path from the worktree's git config
        const { execSync } = await import('child_process');
        // Find the project repo path by reading worktree's .git file
        const gitFile = path.join(worktreePath, '.git');
        if (existsSync(gitFile)) {
          const gitFileContent = (await import('fs')).readFileSync(gitFile, 'utf-8');
          const gitdirMatch = gitFileContent.match(/gitdir:\s*(.+)/);
          if (gitdirMatch) {
            // gitdir points to .git/worktrees/xxx — go up two levels to find main repo
            const worktreeGitDir = gitdirMatch[1].trim();
            const mainGitDir = path.resolve(worktreeGitDir, '../../..');
            execSync(`git -C "${mainGitDir}" worktree remove --force "${worktreePath}"`, {
              stdio: 'pipe',
            });
            console.log(`[worktree] removed: ${worktreePath}`);
          }
        }
      }
    } catch (e) {
      console.warn('[worktree] cleanup failed (non-fatal):', e);
    }
  }
}

// ── Follow-up: resume a completed Claude session ──────────────────────

export async function followUpSession(options: {
  sessionId: string;
  claudeSessionId: string;
  message: string;
  apiMode: string;
  model?: string;
}) {
  const { sessionId, claudeSessionId, message, apiMode, model } = options;
  const supabase = createServerClient();
  const harnessRoot = process.cwd();

  // Update status to running
  await supabase
    .from('sessions')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  pipelineEventBus.emit(sessionId, 'status', { status: 'running' });
  pipelineEventBus.emit(sessionId, 'log', {
    content: `[후속 요청] ${message}`,
    timestamp: new Date().toISOString(),
  });
  await supabase.from('session_logs').insert({
    session_id: sessionId,
    content: `[후속 요청] ${message}`,
    event_type: 'log',
  });

  // Build env
  const sdkEnv: Record<string, string | undefined> = { ...process.env };
  if (apiMode === 'claude-max') {
    delete sdkEnv.ANTHROPIC_API_KEY;
    delete sdkEnv.ANTHROPIC_BASE_URL;
  }

  const requestedModel = model ?? 'claude-sonnet-4-6';

  try {
    const q = query({
      prompt: message,
      options: {
        resume: claudeSessionId,
        cwd: harnessRoot,
        env: sdkEnv,
        allowedTools: [
          'Read', 'Glob', 'Grep', 'Bash', 'Agent', 'Write', 'Edit', 'WebFetch',
          'mcp__Framelink-MCP-for-Figma__get_figma_data',
          'mcp__Framelink-MCP-for-Figma__download_figma_images',
        ],
        permissionMode: 'bypassPermissions',
        model: requestedModel,
      },
    });

    setActiveQuery(sessionId, q);

    for await (const msg of q) {
      if (isSessionStopped(sessionId)) {
        break;
      }

      const sdkMsg = msg as unknown as SDKMessage;
      let content = '';

      if (sdkMsg.type === 'assistant') {
        content = extractTextFromMessage(sdkMsg);
      } else if (sdkMsg.type === 'user') {
        content = extractToolResults(sdkMsg);
      } else if (sdkMsg.type === 'result') {
        if (sdkMsg.is_error) {
          content = `[후속 완료] 실패`;
        } else {
          const cost = sdkMsg.total_cost_usd;
          content = `[후속 완료] 성공 (${cost != null ? `$${cost.toFixed(4)}` : '비용 미제공'}, ${sdkMsg.num_turns ?? 0}턴)`;
        }
        if (sdkMsg.session_id) {
          await supabase
            .from('sessions')
            .update({ claude_session_id: sdkMsg.session_id })
            .eq('id', sessionId);
        }
      }

      if (!content.trim()) continue;

      const timestamp = new Date().toISOString();
      pipelineEventBus.emit(sessionId, 'log', { content, timestamp });
      await supabase.from('session_logs').insert({
        session_id: sessionId,
        content,
        event_type: 'log',
      });

      // Detect user gate
      if (detectUserGate(content)) {
        pipelineEventBus.emit(sessionId, 'usergate', {
          prompt: extractUserGatePrompt(content),
        });
        await supabase
          .from('sessions')
          .update({ status: 'paused' })
          .eq('id', sessionId);
        pipelineEventBus.emit(sessionId, 'status', { status: 'paused' });
      }
    }

    // Mark completed
    if (!isSessionStopped(sessionId)) {
      await supabase
        .from('sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      pipelineEventBus.emit(sessionId, 'status', { status: 'completed' });
    } else {
      clearStopFlag(sessionId);
      await supabase
        .from('sessions')
        .update({ status: 'stopped', updated_at: new Date().toISOString() })
        .eq('id', sessionId);
      pipelineEventBus.emit(sessionId, 'status', { status: 'stopped' });
    }

    pipelineEventBus.emit(sessionId, 'done', {});
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await supabase
      .from('sessions')
      .update({ status: 'error', error_message: errorMessage, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    pipelineEventBus.emit(sessionId, 'status', { status: 'error', error: errorMessage });
    pipelineEventBus.emit(sessionId, 'done', {});
  } finally {
    removeActiveQuery(sessionId);
  }
}
