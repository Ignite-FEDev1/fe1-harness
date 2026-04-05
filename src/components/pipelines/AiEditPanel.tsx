'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  applyContent?: string;
}

export interface AiEditContext {
  type: 'stage' | 'special' | 'pipeline' | 'orchestrator';
  pipelineName?: string;
  stageName?: string;
  specialName?: string;
  getContent: () => string;
}

interface AiEditPanelProps {
  context: AiEditContext;
  onApply: (content: string) => void;
}

function extractApply(text: string): string | undefined {
  const match = text.match(/<apply>([\s\S]*?)<\/apply>/);
  return match ? match[1].trim() : undefined;
}

function stripApplyTags(text: string): string {
  return text.replace(/<apply>[\s\S]*?<\/apply>/g, '').trim();
}

export function AiEditPanel({ context, onApply }: AiEditPanelProps) {
  const { selectedUser, apiMode, currentModel } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed timer during streaming
  const startTimer = useCallback(() => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((v) => v + 1), 1000);
  }, []);
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const newMsg: ChatMessage = { role: 'user', content: text };
    const updated = [...messages, newMsg];
    setMessages(updated);
    setInput('');
    setStreaming(true);
    setStreamingText('');
    startTimer();

    const apiMessages = updated.map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/pipelines/ai-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          context: {
            type: context.type,
            pipelineName: context.pipelineName,
            stageName: context.stageName,
            specialName: context.specialName,
            content: context.getContent(),
          },
          userId: selectedUser?.id ?? null,
          apiMode,
          model: currentModel,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`API ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          if (!block.trim()) continue;
          let eventType = '';
          let dataStr = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) eventType = line.slice(6).trim();
            if (line.startsWith('data:')) dataStr += line.slice(5);
          }
          dataStr = dataStr.trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const evt = JSON.parse(dataStr);
            if (eventType === 'text' && evt.content) {
              accumulated += evt.content;
              setStreamingText(accumulated);
            } else if (eventType === 'error' && evt.message) {
              accumulated += `\n[오류: ${evt.message}]`;
              setStreamingText(accumulated);
            }
          } catch { /* skip */ }
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: accumulated, applyContent: extractApply(accumulated) },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `오류: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    } finally {
      setStreaming(false);
      setStreamingText('');
      stopTimer();
    }
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    lineHeight: '1.5',
    background: 'var(--bg-void)',
    border: '1px solid var(--border-base)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    padding: '8px 10px',
    resize: 'none',
    outline: 'none',
    minHeight: '56px',
    maxHeight: '120px',
  };

  const bubbleBase: React.CSSProperties = {
    maxWidth: '92%',
    padding: '8px 12px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-base)', borderLeft: '1px solid var(--border-dim)' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-dim)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          AI 편집 어시스턴트
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
      >
        {messages.length === 0 && !streaming && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', paddingTop: '48px', lineHeight: '1.7' }}>
            현재 내용을 어떻게 수정할지<br />자연어로 알려주세요.
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '4px' }}>
            <div style={{
              ...bubbleBase,
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? 'rgba(0,229,255,0.08)' : 'var(--bg-raised)',
              border: msg.role === 'user' ? '1px solid rgba(0,229,255,0.2)' : '1px solid var(--border-base)',
              color: msg.role === 'user' ? 'var(--text-primary)' : 'var(--text-primary)',
            }}>
              {msg.applyContent ? stripApplyTags(msg.content) : msg.content}
            </div>
            {msg.applyContent && (
              <button
                onClick={() => onApply(msg.applyContent!)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  background: 'rgba(0,230,118,0.1)',
                  color: 'var(--accent-green)',
                  border: '1px solid rgba(0,230,118,0.3)',
                  cursor: 'pointer',
                }}
              >
                ↓ 적용
              </button>
            )}
          </div>
        ))}

        {streaming && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{
              ...bubbleBase,
              borderRadius: '12px 12px 12px 2px',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-base)',
              color: 'var(--text-primary)',
            }}>
              {streamingText
                ? <>{streamingText}<span style={{ opacity: 0.4 }}>▌</span></>
                : <span style={{ color: 'var(--text-muted)' }}>생각 중... <span style={{ fontSize: '10px', opacity: 0.6 }}>{elapsed}s</span></span>
              }
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '12px', borderTop: '1px solid var(--border-dim)', flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder={'수정 요청... (Enter 전송, Shift+Enter 줄바꿈)'}
          disabled={streaming}
          style={inputStyle}
          rows={2}
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 700,
            padding: '8px 14px',
            borderRadius: '6px',
            background: 'var(--accent-cyan)',
            color: 'var(--bg-void)',
            border: 'none',
            opacity: (streaming || !input.trim()) ? 0.4 : 1,
            cursor: (streaming || !input.trim()) ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          전송
        </button>
      </div>
    </div>
  );
}
