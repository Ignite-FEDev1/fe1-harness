import { query } from '@anthropic-ai/claude-agent-sdk';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { createServerClient } from '@/lib/supabase/server';
import { createFe1WebClient } from '@/lib/supabase/fe1-web';

const H_CHAT_BASE_URL = 'https://h-chat-api.autoever.com/claude-code/v2';
const H_CHAT_MESSAGES_URL =
  'https://internal-apigw-kr.hmg-corp.io/hchat-in/api/v3/claude/messages';

// ── Prompts ────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `당신은 fe1-harness 파이프라인 파일 생성기입니다.
주어진 인터뷰 대화를 분석하여 파이프라인 파일 내용을 텍스트로 출력합니다.
도구(Tool)는 절대 사용하지 마세요. 오직 텍스트만 출력하세요.`;

const USER_PROMPT_HEADER = `아래 파이프라인 설계 인터뷰 대화를 분석하여, fe1-harness 파이프라인 파일 내용을 출력하세요.

## 인터뷰 대화

`;

const USER_PROMPT_FOOTER = `

---

## 출력 형식 (반드시 준수)

각 파일을 아래 구분자로 감싸서 출력하세요. 구분자 이외의 설명 텍스트는 출력하지 마세요.

===FILE: .claude/commands/generic/{파이프라인이름}/pipeline.json===
{
  "stages": [
    { "id": "sequential-stage", "label": "표시 이름 (한글 가능)" },
    { "id": "parallel-stage", "label": "표시 이름 (한글 가능)", "parallel": "입력필드명" }
  ]
}
===ENDFILE===

⚠️ 스테이지 id 규칙 (필수):
- 반드시 영문 소문자, 숫자, 하이픈(-)만 사용 (예: process-ticket, merge, final-review)
- 한글 사용 금지 (❌ 병렬검수, ❌ 코드수정 → ✅ parallel-review, ✅ code-fix)
- label은 한글 자유 (사용자에게 보이는 이름)

===FILE: .claude/commands/generic/{파이프라인이름}/input-schema.json===
{
  "fields": [
    {
      "id": "field_id",
      "label": "표시 레이블",
      "type": "text | textarea | url-list | text-list | url | repeat-group | checkbox | radio | file",
      "required": true,
      "placeholder": "입력 예시",
      "fields": [{ "id": "sub_id", "label": "하위 필드", "type": "text", "placeholder": "예시" }],
      "options": [{ "value": "opt1", "label": "옵션1" }],
      "default": false
    }
  ]
}
===ENDFILE===

각 단계별 .md 파일도 동일한 형식으로 (파일명 = stage id, 영문 소문자만):
===FILE: .claude/commands/generic/{파이프라인이름}/{stage-id}.md===
---
description: 단계 한 줄 설명
---

## 역할
이 에이전트가 맡은 역할

## 입력
이 단계에서 받는 데이터

## 작업 지침
수행할 구체적인 작업 단계별 설명

## 산출물
생성해야 할 파일 또는 결과물 (경로 포함)
===ENDFILE===

## 파이프라인 이름 규칙
- 공백 없이, 한글 가능 (예: QA티켓처리, 신규스펙개발)
- 인터뷰에서 언급된 이름 사용

## 타입 선택 기준 (input-schema.json)
- text: 브랜치명, 짧은 텍스트 한 개
- textarea: 요구사항, 유의사항 등 긴 텍스트
- url-list: URL 여러 개
- text-list: 텍스트 여러 개
- url: URL 한 개
- repeat-group: N개의 구조화된 항목 (반복 입력 그룹). 반드시 "fields" 배열로 하위 필드를 정의해야 함.
  사용자가 카드 형태로 항목을 추가/삭제하며 입력. JSON을 직접 타이핑하지 않음.
  "parallel" 스테이지의 입력으로 주로 사용됨.
  예시: { "id": "tickets", "label": "QA 티켓", "type": "repeat-group", "required": true,
          "fields": [
            { "id": "url", "label": "티켓 URL", "type": "text" },
            { "id": "branch", "label": "작업 브랜치", "type": "text" }
          ] }

- checkbox: on/off 토글. boolean 값. "default"로 기본값 지정 가능.
  예시: { "id": "commit_per_ticket", "label": "티켓별 커밋", "type": "checkbox", "default": true,
          "description": "각 작업 단위마다 개별 커밋을 생성합니다" }

- radio: 여러 옵션 중 하나 선택. "options" 배열 필수.
  예시: { "id": "commit_granularity", "label": "커밋 단위", "type": "radio", "required": true,
          "options": [
            { "value": "per_ticket", "label": "티켓별 커밋" },
            { "value": "single", "label": "전체 1개 커밋" },
            { "value": "none", "label": "커밋 안 함" }
          ],
          "default": "per_ticket" }

- file: 파일 업로드 (이미지, 문서 등). 드래그앤드롭 UI로 업로드됨.
  "accept"로 파일 타입 제한 가능, "multiple"로 복수 파일 허용 (기본 true).
  Agent는 업로드된 파일을 Read 도구로 열어 확인 (이미지도 읽기 가능).
  예시: { "id": "screenshots", "label": "스크린샷", "type": "file", "required": true,
          "accept": "image/*", "multiple": true }

중요: 사용자에게 JSON을 직접 입력하라고 요구하지 마세요.
N개의 구조화된 항목은 반드시 repeat-group을 사용하세요.
on/off 옵션은 checkbox, 2~4개 중 하나 선택은 radio를 사용하세요.
파일/이미지 첨부가 필요하면 file을 사용하세요.
textarea는 자유 형식 텍스트에만 사용합니다.

## 병렬 실행 설계 원칙

"N개를 동시에 처리" 패턴 (티켓 N개, 파일 N개 등):
- 스테이지 하나에 "parallel": "입력필드명" 설정
- 해당 스테이지의 .md는 항목 하나를 처리하는 프롬프트로 작성
- 오케스트레이터가 런타임에 배열 길이만큼 SubAgent를 병렬 실행
- 스테이지 내에서 사용 가능한 변수: {ITEM} (현재 항목 JSON), {ITEM_INDEX} (인덱스), {ITEMS_COUNT} (전체 수)

예시: QA 티켓 N개 병렬 처리 + 머지 순차 실행
\`\`\`json
{ "stages": [
  { "id": "process-ticket", "label": "티켓 처리", "parallel": "tickets" },
  { "id": "merge", "label": "머지" },
  { "id": "post-merge-review", "label": "머지 후 검수" }
]}
\`\`\`
- process-ticket.md: 티켓 1개에 대한 파싱→수정→검수 전체 처리 (ITEM 사용)
- tickets input-schema 타입: repeat-group (하위 필드: url, branch, base_branch, requests)

모든 파일 출력 후 마지막에 반드시:
PIPELINE_NAME:{파이프라인이름}`;

// ── Types ──────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Sender = (event: string, data: unknown) => void;

// ── Helpers ────────────────────────────────────────────────────────────────

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

function buildUserMessage(messages: Message[]): string {
  const conversation = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
  return USER_PROMPT_HEADER + conversation + USER_PROMPT_FOOTER;
}

/** Parse ===FILE: path=== ... ===ENDFILE=== blocks and write to disk */
function writeGeneratedFiles(fullText: string, send: Sender): string | null {
  const filePattern = /===FILE: (.+?)===\n([\s\S]*?)===ENDFILE===/g;
  let match;
  let count = 0;

  while ((match = filePattern.exec(fullText)) !== null) {
    const filePath = match[1].trim();
    const content = match[2];
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    try {
      mkdirSync(path.dirname(absPath), { recursive: true });
      writeFileSync(absPath, content, 'utf8');
      send('progress', { content: `✓ ${filePath}` });
      count++;
    } catch (err) {
      send('progress', { content: `✗ ${filePath}: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  if (count === 0) return null;

  const nameMatch = fullText.match(/PIPELINE_NAME:([^\s\n]+)/);
  return nameMatch ? nameMatch[1].trim() : null;
}

// ── Anthropic-compatible SSE parser (shared with chat route) ───────────────

async function collectAnthropicSse(response: Response, send: Sender): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

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
          if (text) {
            fullText += text;
            send('progress', { content: text });
          }
        }
      } catch { /* skip */ }
    }
  }

  return fullText;
}

// ── Mode handlers ──────────────────────────────────────────────────────────

async function handleHChat(
  messages: Message[],
  token: string,
  model: string,
  send: Sender,
  controller: ReadableStreamDefaultController,
) {
  try {
    const res = await fetch(H_CHAT_MESSAGES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(messages) }],
        stream: true,
      }),
    });
    if (!res.ok) {
      send('error', { message: `H-Chat API ${res.status}: ${(await res.text()).slice(0, 300)}` });
      try { controller.close(); } catch { /* */ }
      return;
    }
    const fullText = await collectAnthropicSse(res, send);
    const pipelineName = writeGeneratedFiles(fullText, send);
    if (pipelineName) {
      send('done', { pipelineName });
    } else {
      send('error', { message: '파이프라인 이름을 추출할 수 없습니다. 생성된 파일을 /pipelines에서 확인해 주세요.' });
    }
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : String(err) });
  }
  try { controller.close(); } catch { /* */ }
}

async function handleAnthropic(
  messages: Message[],
  apiKey: string,
  model: string,
  send: Sender,
  controller: ReadableStreamDefaultController,
) {
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
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(messages) }],
        stream: true,
      }),
    });
    if (!res.ok) {
      send('error', { message: `Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}` });
      try { controller.close(); } catch { /* */ }
      return;
    }
    const fullText = await collectAnthropicSse(res, send);
    const pipelineName = writeGeneratedFiles(fullText, send);
    if (pipelineName) {
      send('done', { pipelineName });
    } else {
      send('error', { message: '파이프라인 이름을 추출할 수 없습니다. 생성된 파일을 /pipelines에서 확인해 주세요.' });
    }
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : String(err) });
  }
  try { controller.close(); } catch { /* */ }
}

async function handleClaudeMax(
  messages: Message[],
  model: string,
  send: Sender,
  controller: ReadableStreamDefaultController,
) {
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${buildUserMessage(messages)}`;
  let fullText = '';

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
        is_error?: boolean;
      };
      if (sdkMsg.type === 'assistant') {
        for (const block of sdkMsg.message?.content ?? []) {
          if (block.type === 'text' && block.text) {
            fullText += block.text;
            send('progress', { content: block.text });
          }
        }
      } else if (sdkMsg.type === 'result' && sdkMsg.is_error) {
        send('error', { message: '파이프라인 생성 중 오류가 발생했습니다.' });
        try { controller.close(); } catch { /* */ }
        return;
      }
    }
  } catch (err) {
    send('error', { message: err instanceof Error ? err.message : String(err) });
    try { controller.close(); } catch { /* */ }
    return;
  }

  const pipelineName = writeGeneratedFiles(fullText, send);
  if (pipelineName) {
    send('done', { pipelineName });
  } else {
    send('error', { message: '파이프라인 이름을 추출할 수 없습니다. 생성된 파일을 /pipelines에서 확인해 주세요.' });
  }
  try { controller.close(); } catch { /* */ }
}

// ── User env loader ────────────────────────────────────────────────────────

async function loadUserEnv(userId: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {};
  const fe1Web = createFe1WebClient();
  const { data: user } = await fe1Web
    .from('users').select('h_chat_api_key').eq('id', userId).single();
  if (user?.h_chat_api_key) env.H_CHAT_TOKEN = user.h_chat_api_key;
  const supabase = createServerClient();
  const { data: settings } = await supabase
    .from('user_settings').select('key, value').eq('user_id', userId);
  for (const s of settings ?? []) { if (s.value) env[s.key] = s.value; }
  return env;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { messages, userId, apiMode, model } = await request.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const userEnv = userId ? await loadUserEnv(userId) : {};
  if (!userEnv.H_CHAT_TOKEN && process.env.H_CHAT_TOKEN) userEnv.H_CHAT_TOKEN = process.env.H_CHAT_TOKEN;
  if (!userEnv.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY) userEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  const hasHChat = !!userEnv.H_CHAT_TOKEN;
  const hasAnthropic = !!userEnv.ANTHROPIC_API_KEY;

  type Mode = 'h-chat' | 'anthropic' | 'claude-max';
  let resolvedMode: Mode;
  if (apiMode === 'h-chat' && hasHChat) resolvedMode = 'h-chat';
  else if (apiMode === 'anthropic' && hasAnthropic) resolvedMode = 'anthropic';
  else if (apiMode === 'claude-max') resolvedMode = 'claude-max';
  else if (hasHChat) resolvedMode = 'h-chat';
  else if (hasAnthropic) resolvedMode = 'anthropic';
  else resolvedMode = 'claude-max';

  const resolvedModel: string = model ?? 'claude-sonnet-4-6';
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = makeSender(controller, encoder);
      if (resolvedMode === 'h-chat') {
        handleHChat(messages, userEnv.H_CHAT_TOKEN, resolvedModel, send, controller);
      } else if (resolvedMode === 'anthropic') {
        handleAnthropic(messages, userEnv.ANTHROPIC_API_KEY, resolvedModel, send, controller);
      } else {
        handleClaudeMax(messages, resolvedModel, send, controller);
      }
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
