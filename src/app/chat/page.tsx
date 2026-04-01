'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { AppHeader } from '@/components/layout/AppHeader';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export default function ChatPage() {
  const { selectedUser, apiMode, setApiMode, availableModes } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const resolvedModeRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setStreaming(true);

    // Create placeholder for assistant response
    const assistantIdx = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: '', timestamp: new Date().toISOString() },
    ]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          userId: selectedUser?.id ?? null,
          apiMode,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIdx] = {
            role: 'system',
            content: err.error || 'Error',
            timestamp: new Date().toISOString(),
          };
          return updated;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            // next line should be data
            const dataIdx = lines.indexOf(line) + 1;
            if (dataIdx < lines.length && lines[dataIdx].startsWith('data: ')) {
              // handled below
            }
            void eventType;
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const prevLine = lines[lines.indexOf(line) - 1] ?? '';
              const event = prevLine.startsWith('event: ')
                ? prevLine.slice(7)
                : '';

              if (event === 'status') {
                resolvedModeRef.current = data.apiMode ?? null;
              } else if (event === 'text') {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[assistantIdx];
                  if (last) {
                    updated[assistantIdx] = {
                      ...last,
                      content: last.content + data.content,
                    };
                  }
                  return updated;
                });
              } else if (event === 'tool') {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[assistantIdx];
                  if (last) {
                    updated[assistantIdx] = {
                      ...last,
                      content:
                        last.content +
                        `\n[도구] ${data.name}: ${JSON.stringify(data.input).slice(0, 100)}`,
                    };
                  }
                  return updated;
                });
              } else if (event === 'error') {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[assistantIdx] = {
                    role: 'system',
                    content: `Error: ${data.message}`,
                    timestamp: new Date().toISOString(),
                  };
                  return updated;
                });
              } else if (event === 'result') {
                // 실제 API 과금(anthropic)일 때만 비용 표시
                if (data.cost != null && resolvedModeRef.current === 'anthropic') {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[assistantIdx];
                    if (last) {
                      updated[assistantIdx] = {
                        ...last,
                        content: last.content + `\n\n— $${data.cost.toFixed(4)}`,
                      };
                    }
                    return updated;
                  });
                }
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = {
          role: 'system',
          content: `Connection error: ${msg}`,
          timestamp: new Date().toISOString(),
        };
        return updated;
      });
    }

    setStreaming(false);
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-void)' }}>
      <AppHeader />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-xs mb-2" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
                API 연결 테스트 및 자유 대화
              </div>
              <div className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                메시지를 입력하면 선택된 사용자의 API 키로 Claude에 전송됩니다
              </div>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[80%] px-4 py-2.5 rounded-lg"
                style={{
                  background:
                    msg.role === 'user'
                      ? 'var(--accent-green-subtle)'
                      : msg.role === 'system'
                        ? 'var(--accent-red-glow)'
                        : 'var(--bg-raised)',
                  border: `1px solid ${
                    msg.role === 'user'
                      ? 'var(--accent-green-dim)'
                      : msg.role === 'system'
                        ? 'var(--accent-red)'
                        : 'var(--border-dim)'
                  }`,
                }}
              >
                {msg.role !== 'user' && (
                  <div
                    className="text-xs mb-1 font-semibold"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: msg.role === 'system' ? 'var(--accent-red)' : 'var(--text-ghost)',
                    }}
                  >
                    {msg.role === 'system' ? 'SYSTEM' : 'CLAUDE'}
                  </div>
                )}
                <pre
                  className="text-sm whitespace-pre-wrap break-words"
                  style={{
                    fontFamily: msg.role === 'user' ? 'var(--font-sans)' : 'var(--font-mono)',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    color:
                      msg.role === 'user'
                        ? 'var(--text-bright)'
                        : msg.role === 'system'
                          ? 'var(--accent-red)'
                          : 'var(--text-primary)',
                  }}
                >
                  {msg.content || (streaming && i === messages.length - 1 ? '...' : '')}
                </pre>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div
        className="px-5 py-4 flex-shrink-0"
        style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-dim)' }}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="max-w-3xl mx-auto flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={streaming ? '응답 대기 중...' : '메시지를 입력하세요...'}
            disabled={streaming}
            className="input-field flex-1"
            style={{ fontSize: '13px' }}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="px-5 py-2 text-xs font-semibold rounded disabled:opacity-30"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              background: 'var(--accent-green)',
              color: 'var(--bg-void)',
            }}
          >
            {streaming ? '...' : 'SEND'}
          </button>
        </form>
      </div>
    </div>
  );
}
