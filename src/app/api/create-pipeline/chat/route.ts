import { query } from '@anthropic-ai/claude-agent-sdk';
import { createServerClient } from '@/lib/supabase/server';
import { createFe1WebClient } from '@/lib/supabase/fe1-web';

const H_CHAT_API_URL =
  'https://internal-apigw-kr.hmg-corp.io/hchat-in/api/v3/claude/messages';

const SYSTEM_PROMPT = `당신은 fe1-harness의 파이프라인 설계 인터뷰어입니다.

fe1-harness는 Claude Code AI 에이전트 파이프라인을 웹 UI에서 실행할 수 있는 플랫폼입니다.
파이프라인은 오케스트레이터 에이전트가 여러 서브에이전트를 순차 또는 병렬로 실행하는 구조입니다.
각 파이프라인은 다음으로 구성됩니다:
- input-schema.json: 매 실행마다 사용자가 제공하는 입력 필드 정의
- pipeline.json: 단계(stages) 구조 정의 (순서, 병렬 그룹 등)
- orchestrator.md: 오케스트레이터 에이전트 프롬프트
- 각 단계 .md 파일: 해당 단계를 수행하는 서브에이전트 프롬프트

당신의 역할: 사용자로부터 파이프라인 생성에 필요한 5가지 정보를 수집하는 것입니다.

수집해야 할 정보:
1. 파이프라인 이름과 목적 (어떤 작업을 자동화하는가)
2. 입력값 정의 (매 실행마다 사용자가 제공하는 데이터의 종류와 형태 — URL 목록, 텍스트, 브랜치명 등)
3. 단계 구성 (몇 개의 단계인지, 순차/병렬 여부, 각 단계의 역할)
4. 각 단계의 산출물 (각 단계가 생성하는 파일이나 결과물)
5. 최종 출력 형태 (파이프라인 완료 시 사용자가 얻는 것)

대화 규칙:
- 반드시 한 번에 한 가지 질문만 하세요
- 답변이 모호하면 구체적인 예시를 들어 재질문하세요
- 이전 답변을 기억하고 연결해서 다음 질문을 구성하세요
- 한국어로 대화하세요
- 간결하게 질문하세요 (2~3문장 이내)
- 반드시 아래 순서대로 수집하세요: name → inputs → stages → outputs → result
- 이전 항목이 완전히 확정되기 전에는 다음 항목으로 절대 넘어가지 마세요

능동적 제안 규칙:
- 단순히 사용자의 답변을 받아 적는 역할에 그치지 마세요
- 사용자의 의도를 파악한 뒤, 필요할 것 같은 입력값·단계·산출물을 먼저 제안하고 확인을 구하세요
- 예: "설명하신 내용으로 보면 각 티켓마다 브랜치명도 입력값으로 필요할 것 같습니다. 맞나요?"
- 예: "병렬 처리 후 하나로 머지하는 단계가 필요할 것 같은데, 추가할까요?"
- 사용자가 미처 생각하지 못한 부분을 짚어주되, 강요하지 말고 선택지를 제시하세요
- 제안이 수락되면 해당 내용을 정의에 반영하고, 거절되면 이유를 짧게 확인하고 넘어가세요

--- 마커 규칙 ---
각 항목은 반드시 해당 주제로 명시적으로 질문하고, 사용자로부터 직접 답변을 받은 뒤에만 확정 마커를 포함하세요.
대화 흐름에서 간접적으로 언급되었더라도, 명시적으로 확인하지 않은 항목에는 마커를 찍지 마세요.
마커는 UI에서 자동으로 제거되며 사용자에게 보이지 않습니다.

항목별 마커 (해당 항목 전용 질문 → 사용자 답변 확인 후에만 포함):
- 이름/목적 확정 시: [STEP_DONE:name]
- 입력값 확정 시: [STEP_DONE:inputs]
- 단계 구성 확정 시: [STEP_DONE:stages]
- 단계 산출물 확정 시: [STEP_DONE:outputs]
- 최종 출력 확정 시: [STEP_DONE:result]
- 5가지 모두 확정 시: [READY_TO_GENERATE]

항목별 확정 기준 및 필수 질문:
- name: "어떤 파이프라인인지, 이름과 목적"을 직접 물어보고 답을 받았을 때
- inputs: "매 실행마다 사용자가 제공해야 하는 입력 데이터"를 직접 물어보고 구체적 필드들을 확인했을 때 (입력값 항목을 건너뛰면 절대 안 됩니다)
- stages: "단계 수, 순서, 병렬 여부"를 직접 물어보고 구조가 확정됐을 때
- outputs: "각 단계의 산출물"을 직접 물어보고 형태가 파악됐을 때
- result: "최종 출력"을 직접 물어보고 확정됐을 때`;

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
    } catch {
      /* stream closed */
    }
  };
}

// Shared parser for Anthropic-compatible SSE streams (H-Chat + Anthropic direct)
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
      const lines = block.split('\n');
      let dataStr = '';
      for (const line of lines) {
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
      } catch {
        /* skip unparseable */
      }
    }
  }
}

async function handleHChat(
  messages: Message[],
  token: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const send = makeSender(controller, encoder);
  try {
    const res = await fetch(H_CHAT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
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
  apiKey: string,
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
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
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
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const send = makeSender(controller, encoder);
  // Agent SDK doesn't support messages array — embed history as text
  const historyText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  const fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n대화 내용:\n\n${historyText}\n\nAssistant:`;

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
        model: 'claude-sonnet-4-6',
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
  const { messages, userId, apiMode } = await request.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userEnv = userId ? await loadUserEnv(userId) : {};
  if (!userEnv.H_CHAT_TOKEN && process.env.H_CHAT_TOKEN)
    userEnv.H_CHAT_TOKEN = process.env.H_CHAT_TOKEN;
  if (!userEnv.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY)
    userEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  const hasHChat = !!userEnv.H_CHAT_TOKEN;
  const hasAnthropic = !!userEnv.ANTHROPIC_API_KEY;

  type Mode = 'h-chat' | 'anthropic' | 'claude-max';
  let mode: Mode;
  if (apiMode === 'h-chat' && hasHChat) mode = 'h-chat';
  else if (apiMode === 'anthropic' && hasAnthropic) mode = 'anthropic';
  else if (apiMode === 'claude-max') mode = 'claude-max';
  else if (hasHChat) mode = 'h-chat';
  else if (hasAnthropic) mode = 'anthropic';
  else mode = 'claude-max';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      if (mode === 'h-chat') handleHChat(messages, userEnv.H_CHAT_TOKEN, controller, encoder);
      else if (mode === 'anthropic') handleAnthropic(messages, userEnv.ANTHROPIC_API_KEY, controller, encoder);
      else handleClaudeMax(messages, controller, encoder);
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
