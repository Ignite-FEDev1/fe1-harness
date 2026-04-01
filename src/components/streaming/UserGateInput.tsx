'use client';

import { useState } from 'react';

interface UserGateInputProps {
  sessionId: string;
  prompt: string;
  onResponded: () => void;
}

export function UserGateInput({
  sessionId,
  prompt,
  onResponded,
}: UserGateInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (res.ok) {
        setMessage('');
        onResponded();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="p-4 glow-amber"
      style={{
        background: 'var(--bg-raised)',
        borderTop: '2px solid var(--accent-amber)',
      }}
    >
      {/* Gate prompt display */}
      <div className="mb-3">
        <div
          className="flex items-center gap-2 mb-2"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full status-pulse"
            style={{ background: 'var(--accent-amber)', boxShadow: '0 0 6px var(--accent-amber)' }}
          />
          <span
            className="text-xs font-semibold tracking-wider"
            style={{ color: 'var(--accent-amber)', fontSize: '10px' }}
          >
            OPERATOR INPUT REQUIRED
          </span>
        </div>
        <pre
          className="text-xs whitespace-pre-wrap rounded-md p-3 max-h-40 overflow-y-auto"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-primary)',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-base)',
          }}
        >
          {prompt}
        </pre>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="응답을 입력하세요..."
          className="input-field input-mono flex-1"
          style={{ borderColor: 'var(--accent-amber-dim)', fontSize: '12px' }}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="px-5 py-2 text-xs font-semibold rounded transition-all disabled:opacity-30"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.06em',
            background: 'var(--accent-amber)',
            color: 'var(--bg-void)',
          }}
        >
          {sending ? 'SENDING...' : 'RESPOND'}
        </button>
      </form>
    </div>
  );
}
