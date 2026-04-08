import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, mkdirSync } from 'fs';
import path from 'path';

type ApiMode = 'h-chat' | 'claude-max';

const H_CHAT_CONFIG = {
  ANTHROPIC_BASE_URL: 'https://h-chat-api.autoever.com/claude-code/v2',
  API_TIMEOUT_MS: '3000000',
  DISABLE_AUTOUPDATER: '1',
};

const MODE_LABELS: Record<ApiMode, string> = {
  'h-chat': 'H-Chat (회사 내부)',
  'claude-max': 'Claude Max (로컬 OAuth)',
};

export async function POST(request: Request) {
  const { apiMode, userId } = await request.json() as { apiMode: ApiMode; userId?: string };

  if (!apiMode) {
    return new Response(JSON.stringify({ error: 'apiMode is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const harnessRoot = process.cwd();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(harnessRoot, 'test-results', apiMode, timestamp);

  // Create output directory
  mkdirSync(outputDir, { recursive: true });

  // Read test-pipeline.md
  const pipelineMdPath = path.join(harnessRoot, '.claude/commands/test-pipeline.md');
  let pipelineMd: string;
  try {
    pipelineMd = readFileSync(pipelineMdPath, 'utf-8');
  } catch {
    return new Response(JSON.stringify({ error: 'test-pipeline.md not found' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Remove frontmatter
  const frontmatterEnd = pipelineMd.indexOf('---', pipelineMd.indexOf('---') + 3);
  const promptBody = frontmatterEnd !== -1 ? pipelineMd.slice(frontmatterEnd + 3).trim() : pipelineMd;
  const prompt = promptBody.replace(/\$ARGUMENTS/g, outputDir);

  // Build SDK env based on mode
  const sdkEnv: Record<string, string | undefined> = { ...process.env };

  if (apiMode === 'h-chat') {
    // Load H_CHAT_TOKEN from user or process.env
    let hChatToken = process.env.H_CHAT_TOKEN ?? '';
    if (userId) {
      const { createFe1WebClient } = await import('@/lib/supabase/fe1-web');
      const db = createFe1WebClient();
      const { data } = await db.from('users').select('h_chat_api_key').eq('id', userId).single();
      if (data?.h_chat_api_key) hChatToken = data.h_chat_api_key;
    }
    if (!hChatToken) {
      return new Response(JSON.stringify({ error: 'H_CHAT_TOKEN이 설정되지 않았습니다' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    sdkEnv.ANTHROPIC_AUTH_TOKEN = hChatToken;
    sdkEnv.ANTHROPIC_API_KEY = hChatToken;
    sdkEnv.ANTHROPIC_BASE_URL = H_CHAT_CONFIG.ANTHROPIC_BASE_URL;
    sdkEnv.API_TIMEOUT_MS = H_CHAT_CONFIG.API_TIMEOUT_MS;
    sdkEnv.DISABLE_AUTOUPDATER = H_CHAT_CONFIG.DISABLE_AUTOUPDATER;
  } else {
    // claude-max: use ~/.claude/ OAuth — remove any injected API key
    delete sdkEnv.ANTHROPIC_API_KEY;
    delete sdkEnv.ANTHROPIC_BASE_URL;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch { /* closed */ }
      };

      const run = async () => {
        send('start', {
          apiMode,
          modeLabel: MODE_LABELS[apiMode],
          outputDir,
          timestamp,
        });

        try {
          const q = query({
            prompt,
            options: {
              cwd: harnessRoot,
              env: sdkEnv,
              allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Agent'],
              permissionMode: 'bypassPermissions',
              model: 'claude-sonnet-4-6',
            },
          });

          for await (const msg of q) {
            const sdkMsg = msg as unknown as {
              type: string;
              message?: { content?: { type: string; text?: string; name?: string; input?: unknown }[] };
              is_error?: boolean;
              total_cost_usd?: number;
              num_turns?: number;
            };

            if (sdkMsg.type === 'assistant') {
              for (const block of sdkMsg.message?.content ?? []) {
                if (block.type === 'text' && block.text?.trim()) {
                  send('log', { content: block.text });
                } else if (block.type === 'tool_use' && block.name) {
                  send('tool', { name: block.name, input: block.input });
                }
              }
            } else if (sdkMsg.type === 'result') {
              send('result', {
                error: sdkMsg.is_error,
                turns: sdkMsg.num_turns,
                cost: sdkMsg.total_cost_usd,
              });
            }
          }

          send('done', { outputDir, success: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          send('error', { message });
          send('done', { outputDir, success: false });
        }

        try { controller.close(); } catch { /* */ }
      };

      run();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
