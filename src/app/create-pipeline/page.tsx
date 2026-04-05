'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { AppHeader } from '@/components/layout/AppHeader';

// ── Types ─────────────────────────────────────────────────────────────

type Role = 'user' | 'assistant' | 'system';

interface Message {
  role: Role;
  content: string;
}

// ── Constants ─────────────────────────────────────────────────────────

const READY_MARKER = '[READY_TO_GENERATE]';
const STEP_DONE_RE = /\[STEP_DONE:([a-z]+)\]/g;

const STEPS = [
  { id: 'name',    label: '이름 / 목적' },
  { id: 'inputs',  label: '입력값 정의' },
  { id: 'stages',  label: '단계 구성' },
  { id: 'outputs', label: '단계 산출물' },
  { id: 'result',  label: '최종 출력' },
] as const;

const OPENING: Message = {
  role: 'assistant',
  content:
    '파이프라인 설계 인터뷰어입니다.\n\n' +
    '몇 가지 질문을 통해 파이프라인 초안(오케스트레이터, 각 단계 프롬프트, 입력 스키마)을 자동 생성해 드립니다. ' +
    '완성되면 /pipelines에서 수정하고, /sessions에서 바로 실행할 수 있습니다.\n\n' +
    '어떤 파이프라인을 만들고 싶으신가요? 이름과 목적을 알려주세요.\n\n' +
    '─────────────────────────────\n' +
    '입력 예시\n\n' +
    '"QA 티켓 자동 처리 파이프라인.\n' +
    'Jira QA 티켓 링크를 여러 개 받아서, 각 티켓마다 지정된 브랜치에서\n' +
    '코드를 수정하고 검수한 뒤, 최종적으로 하나의 브랜치로 머지합니다.\n' +
    '티켓이 n개면 수정·검수를 n개 병렬로 동시에 처리하고 싶습니다."\n' +
    '─────────────────────────────\n\n' +
    '자세할수록 더 정확한 파이프라인이 나옵니다. 생각나는 대로 자유롭게 작성해주세요.',
};

// ── Helpers ───────────────────────────────────────────────────────────

/** 대화 state에서 API로 보낼 messages 배열 추출 (opening 제외, user/assistant만) */
function toApiMessages(msgs: Message[]): { role: 'user' | 'assistant'; content: string }[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(1) // opening 메시지 제외 (첫 assistant 메시지는 하드코딩, API 불필요)
    .filter((m) => m.content.trim() !== '') // 빈 streaming placeholder 제외
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

/** 텍스트에서 마커를 모두 제거해 표시용 텍스트 반환 */
function stripMarkers(text: string): string {
  return text.replace(STEP_DONE_RE, '').replace(READY_MARKER, '').trimEnd();
}

// ── Sub-components ────────────────────────────────────────────────────

function StepItem({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div
      className="flex items-center gap-3"
      style={{ padding: '8px 0', opacity: done || active ? 1 : 0.45 }}
    >
      <div
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: done
            ? 'var(--accent-green)'
            : active
              ? 'rgba(0,230,118,0.15)'
              : 'var(--bg-overlay)',
          border: done
            ? 'none'
            : active
              ? '1px solid rgba(0,230,118,0.6)'
              : '1px solid var(--border-dim)',
          transition: 'all 0.2s',
        }}
      >
        {done ? (
          <span style={{ color: 'var(--bg-void)', fontSize: '10px', fontWeight: 900 }}>✓</span>
        ) : active ? (
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-green)',
              display: 'block',
            }}
          />
        ) : null}
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: done
            ? 'var(--text-primary)'
            : active
              ? 'var(--accent-green)'
              : 'var(--text-muted)',
          fontWeight: active ? 600 : 400,
          transition: 'color 0.2s',
        }}
      >
        {label}
      </span>
    </div>
  );
}

function MessageBubble({ msg, streaming }: { msg: Message; streaming?: boolean }) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: '10px',
          background: isUser
            ? 'var(--accent-green-subtle)'
            : isSystem
              ? 'rgba(248,113,113,0.1)'
              : 'var(--bg-raised)',
          border: `1px solid ${
            isUser
              ? 'var(--accent-green-dim)'
              : isSystem
                ? 'rgba(248,113,113,0.35)'
                : 'var(--border-dim)'
          }`,
        }}
      >
        {!isUser && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: isSystem ? 'rgba(248,113,113,0.8)' : 'var(--text-muted)',
              marginBottom: '5px',
            }}
          >
            {isSystem ? 'ERROR' : 'INTERVIEWER'}
          </div>
        )}
        <pre
          style={{
            fontFamily: isUser ? 'var(--font-sans)' : 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: 1.65,
            color: isUser
              ? 'var(--text-bright)'
              : isSystem
                ? 'rgba(248,113,113,0.9)'
                : 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}
        >
          {msg.content || (streaming ? '...' : '')}
        </pre>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function CreatePipelinePage() {
  const router = useRouter();
  const { selectedUser, apiMode } = useUser();

  const [messages, setMessages] = useState<Message[]>([OPENING]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateLog, setGenerateLog] = useState<string[]>([]);
  const [generatedName, setGeneratedName] = useState<string | null>(null);

  const streamAccRef = useRef(''); // accumulates current stream chunk-by-chunk
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    streamAccRef.current = '';

    // Add streaming placeholder
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    // Build API messages: current state + new user message
    const apiMsgs = toApiMessages([...messages, userMsg]);

    try {
      const res = await fetch('/api/create-pipeline/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMsgs,
          userId: selectedUser?.id ?? null,
          apiMode,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'system', content: err.error || 'API 오류가 발생했습니다.' };
          return next;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.startsWith('data: ')) continue;

          const prevLine = i > 0 ? lines[i - 1] : '';
          const event = prevLine.startsWith('event: ') ? prevLine.slice(7) : '';

          try {
            const data = JSON.parse(line.slice(6));
            if (event === 'text' && data.content) {
              streamAccRef.current += data.content;
              const acc = streamAccRef.current;

              // Detect [STEP_DONE:xxx] markers
              const stepMatches = [...acc.matchAll(STEP_DONE_RE)];
              if (stepMatches.length > 0) {
                setDoneSteps((prev) => {
                  const next = new Set(prev);
                  for (const m of stepMatches) next.add(m[1]);
                  return next;
                });
              }

              // Detect [READY_TO_GENERATE]
              if (acc.includes(READY_MARKER)) {
                setReadyToGenerate(true);
              }

              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: stripMarkers(acc) };
                return next;
              });
            } else if (event === 'error' && data.message) {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: 'system', content: data.message };
                return next;
              });
            }
          } catch {
            /* skip parse errors */
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'system', content: `연결 오류: ${msg}` };
        return next;
      });
    }

    setStreaming(false);
    inputRef.current?.focus();
  }, [input, streaming, messages, selectedUser, apiMode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setGenerateLog([]);

    const apiMsgs = toApiMessages(messages);

    try {
      const res = await fetch('/api/create-pipeline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMsgs,
          userId: selectedUser?.id ?? null,
          apiMode,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setGenerateLog([`오류: ${err.error ?? '알 수 없는 오류'}`]);
        setGenerating(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].startsWith('data: ')) continue;
          const prevLine = i > 0 ? lines[i - 1] : '';
          const event = prevLine.startsWith('event: ') ? prevLine.slice(7) : '';
          try {
            const data = JSON.parse(lines[i].slice(6));
            if (event === 'progress' && data.content) {
              const line: string = data.content;
              if (line.startsWith('✓') || line.startsWith('✗')) {
                setGenerateLog((prev) => [...prev, line]);
              }
            } else if (event === 'done' && data.pipelineName) {
              setGeneratedName(data.pipelineName);
              setGenerating(false);
              return;
            } else if (event === 'error' && data.message) {
              setGenerateLog((prev) => [...prev, `오류: ${data.message}`]);
              setGenerating(false);
              return;
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setGenerateLog([`연결 오류: ${err instanceof Error ? err.message : String(err)}`]);
    }

    setGenerating(false);
  };

  const allDone = readyToGenerate || doneSteps.size >= STEPS.length;

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-void)' }}>
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside
          className="flex flex-col flex-shrink-0"
          style={{
            width: '240px',
            background: 'var(--bg-base)',
            borderRight: '1px solid var(--border-dim)',
            padding: '20px 16px',
          }}
        >
          {/* Title */}
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}
            >
              Pipeline Builder
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              인터뷰 완료 후 파이프라인 초안을 생성합니다
            </div>
          </div>

          {/* Steps */}
          <div
            style={{
              borderTop: '1px solid var(--border-dim)',
              paddingTop: '16px',
              flex: 1,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}
            >
              수집 항목
            </div>
            {STEPS.map((step) => {
              const done = allDone || doneSteps.has(step.id);
              const active = !done && STEPS.findIndex((s) => !doneSteps.has(s.id)) === STEPS.indexOf(step);
              return (
                <StepItem
                  key={step.id}
                  label={step.label}
                  done={done}
                  active={active}
                />
              );
            })}
          </div>

          {/* [DEV] 테스트 생성 버튼 */}
          <div style={{ marginTop: '12px' }}>
            <button
              onClick={() => {
                const testMessages = [
                  { role: 'assistant' as const, content: '파이프라인 설계를 도와드리겠습니다.' },
                  { role: 'user' as const, content: `파이프라인 이름: qa-ticket-parallel-processor

입력값:
- 배열 (티켓 수만큼): [{ ticket_url, branch, base_branch, requests }, ...]
- 전역 (1개): { merge_branch, global_instructions }

단계 구성:
- 병렬 (티켓 n개): 티켓 파싱 → 코드 수정 → 검수
- 순차 최종: 머지 → 머지 후 검수

단계별 산출물:
- 티켓 파싱: 티켓 정보 요약
- 코드 수정: 코드 변경 커밋
- 검수: 검수 결과 리포트
- 머지: 머지 완료된 브랜치
- 머지 후 검수: 최종 검수 리포트

최종 출력: 마크다운 보고서` },
                ];
                setGenerating(true);
                setGenerateLog([]);
                fetch('/api/create-pipeline/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messages: testMessages, userId: selectedUser?.id ?? null, apiMode }),
                }).then(async (res) => {
                  const reader = res.body!.getReader();
                  const decoder = new TextDecoder();
                  let buf = '';
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split('\n');
                    buf = lines.pop() ?? '';
                    for (let i = 0; i < lines.length; i++) {
                      if (!lines[i].startsWith('data: ')) continue;
                      const event = (i > 0 && lines[i-1].startsWith('event: ')) ? lines[i-1].slice(7) : '';
                      try {
                        const data = JSON.parse(lines[i].slice(6));
                        if (event === 'progress' && data.content) { const l: string = data.content; if (l.startsWith('✓') || l.startsWith('✗')) setGenerateLog(p => [...p, l]); }
                        else if (event === 'done' && data.pipelineName) { setGeneratedName(data.pipelineName); setGenerating(false); return; }
                        else if (event === 'error' && data.message) { setGenerateLog(p => [...p, `오류: ${data.message}`]); setGenerating(false); return; }
                      } catch { /* skip */ }
                    }
                  }
                  setGenerating(false);
                }).catch(() => setGenerating(false));
              }}
              disabled={generating}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: '1px dashed var(--border-dim)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', width: '100%', opacity: generating ? 0.4 : 1 }}
            >
              [DEV] 테스트 생성
            </button>
          </div>

          {/* Generate button */}
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-dim)', paddingTop: '16px' }}>
            {allDone && !generating && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--accent-green)',
                  marginBottom: '10px',
                  lineHeight: 1.5,
                }}
              >
                정보 수집 완료. 파이프라인을 생성할 수 있습니다.
              </div>
            )}
            <button
              onClick={handleGenerate}
              disabled={!allDone || generating}
              style={{
                width: '100%',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '9px 14px',
                borderRadius: '5px',
                border: 'none',
                cursor: allDone && !generating ? 'pointer' : 'not-allowed',
                background: allDone
                  ? 'var(--accent-green)'
                  : 'var(--bg-overlay)',
                color: allDone ? 'var(--bg-void)' : 'var(--text-muted)',
                boxShadow: allDone ? '0 0 12px rgba(0,230,118,0.25)' : 'none',
                opacity: generating ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              {generating ? '생성 중...' : '파이프라인 생성하기'}
            </button>
            {!allDone && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginTop: '8px',
                  lineHeight: 1.5,
                }}
              >
                {STEPS.length - doneSteps.size}개 항목 수집 후 활성화됩니다
              </div>
            )}
          </div>
        </aside>

        {/* ── Chat area ── */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Chat header */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-dim)',
              background: 'var(--bg-base)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-bright)',
              }}
            >
              파이프라인 만들기
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              {doneSteps.size} / {STEPS.length} 수집 완료
            </span>
            {allDone && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--accent-green)',
                  background: 'rgba(0,230,118,0.1)',
                  border: '1px solid rgba(0,230,118,0.3)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                }}
              >
                READY
              </span>
            )}
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ padding: '20px' }}
          >
            <div
              style={{
                maxWidth: '720px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  msg={msg}
                  streaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}
                />
              ))}

              {/* 생성 완료 */}
              {generatedName && (
                <div style={{ background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)', borderRadius: '10px', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-green)', marginBottom: '4px' }}>파이프라인 생성 완료</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{generatedName}</div>
                  </div>
                  <button
                    onClick={() => router.push(`/pipelines/generic/${encodeURIComponent(generatedName)}`)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '6px', background: 'var(--accent-green)', color: 'var(--bg-void)', border: 'none', cursor: 'pointer', flexShrink: 0 }}
                  >
                    파이프라인 보기 →
                  </button>
                </div>
              )}

              {/* 생성 중 / 생성 실패 로그 */}
              {(generating || (generateLog.length > 0 && !generatedName)) && (
                <div
                  style={{
                    background: 'var(--bg-base)',
                    border: `1px solid ${generating ? 'var(--border-dim)' : 'rgba(248,113,113,0.3)'}`,
                    borderRadius: '10px',
                    padding: '14px 16px',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: generating ? 'var(--accent-cyan)' : 'rgba(248,113,113,0.8)',
                      marginBottom: '10px',
                    }}
                  >
                    {generating ? 'GENERATING PIPELINE...' : 'GENERATION STOPPED'}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.7,
                      maxHeight: '240px',
                      overflowY: 'auto',
                    }}
                  >
                    {generateLog.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>파이프라인 파일 생성 중...</span>
                    ) : (
                      generateLog.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))
                    )}
                  </div>
                  {!generating && (
                    <button
                      onClick={() => { setGenerateLog([]); }}
                      style={{ marginTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer' }}
                    >
                      닫기
                    </button>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-dim)',
              background: 'var(--bg-base)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                maxWidth: '720px',
                margin: '0 auto',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-end',
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={streaming ? '응답 대기 중...' : '답변을 입력하세요 (Shift+Enter로 줄바꿈)'}
                disabled={streaming}
                rows={1}
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  background: 'var(--bg-void)',
                  border: '1px solid var(--border-base)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  padding: '9px 12px',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: 1.5,
                  maxHeight: '120px',
                  overflowY: 'auto',
                  opacity: streaming ? 0.5 : 1,
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={streaming || !input.trim()}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  padding: '9px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'var(--accent-cyan)',
                  color: 'var(--bg-void)',
                  cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: streaming || !input.trim() ? 0.35 : 1,
                  flexShrink: 0,
                  transition: 'opacity 0.15s',
                }}
              >
                {streaming ? '...' : 'SEND'}
              </button>
            </div>
            <div
              style={{
                maxWidth: '720px',
                margin: '6px auto 0',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              Enter로 전송 · Shift+Enter로 줄바꿈
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
