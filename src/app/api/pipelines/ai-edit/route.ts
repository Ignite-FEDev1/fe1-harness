import { query } from '@anthropic-ai/claude-agent-sdk';
import { createServerClient } from '@/lib/supabase/server';
import { createFe1WebClient } from '@/lib/supabase/fe1-web';

const H_CHAT_API_URL =
  'https://internal-apigw-kr.hmg-corp.io/hchat-in/api/v3/claude/messages';

interface EditContext {
  type: 'stage' | 'special' | 'pipeline' | 'orchestrator';
  pipelineName?: string;
  stageName?: string;
  specialName?: string;
  content: string;
}

function buildSystemPrompt(ctx: EditContext): string {
  if (ctx.type === 'pipeline') {
    return `당신은 fe1-harness 파이프라인 구성 편집 어시스턴트입니다.

현재 편집 중인 파이프라인:
- 이름(slug): ${ctx.pipelineName}

현재 구성 (JSON):
---
${ctx.content}
---

stages 배열의 각 항목은 { id, label?, parallel? } 구조입니다.
parallel 필드가 있는 스테이지는 해당 이름의 입력 배열 길이만큼 에이전트를 동시에 실행합니다.
예: { "id": "process-ticket", "parallel": "tickets" } → pipeline_inputs.tickets 배열 항목마다 1개씩 병렬 실행

사용자의 요청에 따라 파이프라인 구성을 수정해주세요.
수정이 필요한 경우 반드시 다음 형식으로 전체 JSON을 반환하세요:

<apply>
{"stages": [...], "label": "...", "description": "..."}
</apply>

<apply> 태그 안에는 JSON만 넣고 다른 텍스트는 포함하지 마세요.
수정 없이 설명만 할 경우 <apply> 태그를 사용하지 마세요.
한국어로 답변하세요.`;
  }

  if (ctx.type === 'stage') {
    return `당신은 fe1-harness 파이프라인 스테이지 프롬프트 편집 어시스턴트입니다.

현재 편집 중인 파일:
- 파이프라인: ${ctx.pipelineName}
- 스테이지: ${ctx.stageName}.md

현재 내용:
---
${ctx.content}
---

이 파일은 AI 에이전트에게 전달되는 마크다운 형식의 프롬프트입니다.
사용자의 요청에 따라 프롬프트 내용을 수정해주세요.

수정이 필요한 경우 반드시 다음 형식으로 전체 수정된 내용을 반환하세요:

<apply>
수정된 전체 마크다운 내용
</apply>

수정 없이 설명만 할 경우 <apply> 태그를 사용하지 마세요.
한국어로 답변하세요.`;
  }

  if (ctx.type === 'orchestrator') {
    return `당신은 fe1-harness 오케스트레이터 프롬프트 편집 어시스턴트입니다.

오케스트레이터는 모든 파이프라인 실행을 제어하는 핵심 프롬프트입니다.
session.md를 읽어 파이프라인 단계들을 순서대로 실행하고, 병렬/순차 실행을 조율합니다.

현재 내용:
---
${ctx.content}
---

사용자의 요청에 따라 오케스트레이터 프롬프트를 수정해주세요.

수정이 필요한 경우 반드시 다음 형식으로 전체 수정된 내용을 반환하세요:

<apply>
수정된 전체 마크다운 내용
</apply>

수정 없이 설명만 할 경우 <apply> 태그를 사용하지 마세요.
한국어로 답변하세요.`;
  }

  return `당신은 fe1-harness 특수 규칙 편집 어시스턴트입니다.

현재 편집 중인 파일:
- 특수 규칙: ${ctx.specialName}.md

현재 내용:
---
${ctx.content}
---

이 파일은 프로젝트별 컨텍스트와 규칙을 담은 자유형식 마크다운 문서입니다.
AI 오케스트레이터가 이 내용 전체를 {SPECIAL_RULES}로 받아 각 스테이지에 활용합니다.
사용자의 요청에 따라 내용을 수정해주세요.

수정이 필요한 경우 반드시 다음 형식으로 전체 수정된 내용을 반환하세요:

<apply>
수정된 전체 마크다운 내용
</apply>

수정 없이 설명만 할 경우 <apply> 태그를 사용하지 마세요.
한국어로 답변하세요.`;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Sender = (event: string, data: unknown) => void;

function makeSender(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
): Sender {
  return (event, data) => {
    try {
      controller.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    } catch { /* stream closed */ }
  };
}

async function parseAnthropicSse(response: Response, send: Sender) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      if (!block.trim()) continue;
      let dataStr = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('data:')) dataStr += line.slice(5);
      }
      dataStr = dataStr.trim();
      if (!dataStr || dataStr === '[DONE]') continue;
      try {
        const evt = JSON.parse(dataStr);
        if (evt.type === 'content_block_delta') {
          const text = evt.delta?.text ?? evt.delta?.partial_json;
          if (text) send('text', { content: text });
        }
      } catch { /* skip */ }
    }
  }
}

async function handleHChat(
  messages: Message[],
  systemPrompt: string,
  token: string,
  model: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const send = makeSender(controller, encoder);
  try {
    const res = await fetch(H_CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model,
        max_tokens: 8096,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });
    if (!res.ok) {
      send('error', { message: `H-Chat API ${res.status}: ${(await res.text()).slice(0, 300)}` });
    } else {
      await parseAnthropicSse(res, send);
    }
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : String(err) });
  }
  send('done', {});
  try { controller.close(); } catch { /* */ }
}

async function handleAnthropic(
  messages: Message[],
  systemPrompt: string,
  apiKey: string,
  model: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const send = makeSender(controller, encoder);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8096,
        system: systemPrompt,
        messages,
        stream: true,
      }),
    });
    if (!res.ok) {
      send('error', { message: `Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}` });
    } else {
      await parseAnthropicSse(res, send);
    }
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : String(err) });
  }
  send('done', {});
  try { controller.close(); } catch { /* */ }
}

async function handleClaudeMax(
  messages: Message[],
  systemPrompt: string,
  model: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const send = makeSender(controller, encoder);
  const historyText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  const fullPrompt = `${systemPrompt}\n\n---\n\n${historyText}\n\nAssistant:`;

  try {
    const sdkEnv: Record<string, string | undefined> = { ...process.env };
    delete sdkEnv.ANTHROPIC_API_KEY;
    delete sdkEnv.ANTHROPIC_BASE_URL;

    const q = query({
      prompt: fullPrompt,
      options: {
        cwd: process.cwd(),
        env: sdkEnv,
        allowedTools: [],
        permissionMode: 'bypassPermissions',
        model,
      },
    });

    for await (const msg of q) {
      const sdkMsg = msg as unknown as {
        type: string;
        message?: { content?: { type: string; text?: string }[] };
      };
      if (sdkMsg.type === 'assistant') {
        for (const block of sdkMsg.message?.content ?? []) {
          if (block.type === 'text' && block.text) {
            send('text', { content: block.text });
          }
        }
      }
    }
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : String(err) });
  }
  send('done', {});
  try { controller.close(); } catch { /* */ }
}

async function loadUserEnv(userId: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  const fe1Web = createFe1WebClient();
  const { data: user } = await fe1Web
    .from('users')
    .select('h_chat_api_key')
    .eq('id', userId)
    .single();
  if (user?.h_chat_api_key) env.H_CHAT_TOKEN = user.h_chat_api_key;

  const supabase = createServerClient();
  const { data: settings } = await supabase
    .from('user_settings')
    .select('key, value')
    .eq('user_id', userId);
  for (const s of settings ?? []) {
    if (s.value) env[s.key] = s.value;
  }
  return env;
}

export async function POST(request: Request) {
  const { messages, context, userId, apiMode, model } = await request.json() as {
    messages: Message[];
    context: EditContext;
    userId?: string;
    apiMode?: string;
    model?: string;
  };

  const resolvedModel = model ?? 'claude-sonnet-4-6';

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = buildSystemPrompt(context);

  const userEnv = userId ? await loadUserEnv(userId) : {};
  if (!userEnv.H_CHAT_TOKEN && process.env.H_CHAT_TOKEN)
    userEnv.H_CHAT_TOKEN = process.env.H_CHAT_TOKEN;
  if (!userEnv.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY)
    userEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  type Mode = 'h-chat' | 'anthropic' | 'claude-max';
  let mode: Mode;
  if (apiMode === 'h-chat' && userEnv.H_CHAT_TOKEN) mode = 'h-chat';
  else if (apiMode === 'anthropic' && userEnv.ANTHROPIC_API_KEY) mode = 'anthropic';
  else if (apiMode === 'claude-max') mode = 'claude-max';
  else if (userEnv.H_CHAT_TOKEN) mode = 'h-chat';
  else if (userEnv.ANTHROPIC_API_KEY) mode = 'anthropic';
  else mode = 'claude-max';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      if (mode === 'h-chat')
        handleHChat(messages, systemPrompt, userEnv.H_CHAT_TOKEN, resolvedModel, controller, encoder);
      else if (mode === 'anthropic')
        handleAnthropic(messages, systemPrompt, userEnv.ANTHROPIC_API_KEY, resolvedModel, controller, encoder);
      else
        handleClaudeMax(messages, systemPrompt, resolvedModel, controller, encoder);
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
