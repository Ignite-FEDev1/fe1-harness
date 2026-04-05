'use client';

import { useState } from 'react';

interface AiPanelToggleProps {
  open: boolean;
  onToggle: () => void;
}

export function AiPanelToggle({ open, onToggle }: AiPanelToggleProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={open ? 'AI 어시스턴트 숨기기' : 'AI 어시스턴트 열기'}
      style={{
        width: '28px',
        flexShrink: 0,
        background: hovered
          ? open
            ? 'rgba(255,255,255,0.015)'
            : 'rgba(0,229,255,0.04)'
          : 'transparent',
        border: 'none',
        borderLeft: `1px solid ${
          hovered
            ? open
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(0,229,255,0.28)'
            : 'var(--border-dim)'
        }`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}
    >
      {/* Pill handle */}
      <div
        style={{
          width: '18px',
          height: '64px',
          borderRadius: '9px',
          background: hovered
            ? open
              ? 'var(--bg-overlay)'
              : 'rgba(0,229,255,0.08)'
            : 'var(--bg-raised)',
          border: `1px solid ${
            hovered
              ? open
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,229,255,0.32)'
              : 'rgba(255,255,255,0.05)'
          }`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0',
          transition: 'all 0.2s ease',
          boxShadow: hovered
            ? open
              ? '0 2px 10px rgba(0,0,0,0.5)'
              : '0 0 14px rgba(0,229,255,0.18), 0 2px 10px rgba(0,0,0,0.4)'
            : '0 1px 5px rgba(0,0,0,0.35)',
        }}
      >
        {open ? (
          /* ── OPEN state: grip dots + collapse chevron ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3.5px' }}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  display: 'block',
                  width: '3px',
                  height: '3px',
                  borderRadius: '50%',
                  background: hovered
                    ? `rgba(255,255,255,${0.55 - i * 0.08})`
                    : `rgba(255,255,255,${0.18 - i * 0.02})`,
                  transition: `background 0.15s ease ${i * 25}ms`,
                }}
              />
            ))}
            {/* Chevron right (→ collapse) */}
            <div
              style={{
                marginTop: '6px',
                width: '5px',
                height: '5px',
                borderRight: `1.5px solid ${hovered ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)'}`,
                borderTop: `1.5px solid ${hovered ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)'}`,
                transform: 'rotate(45deg)',
                transition: 'border-color 0.15s ease',
              }}
            />
          </div>
        ) : (
          /* ── CLOSED state: expand chevron + AI label ── */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            {/* Chevron left (← expand) */}
            <div
              style={{
                width: '5px',
                height: '5px',
                borderLeft: `1.5px solid ${hovered ? 'var(--accent-cyan)' : 'rgba(0,229,255,0.5)'}`,
                borderTop: `1.5px solid ${hovered ? 'var(--accent-cyan)' : 'rgba(0,229,255,0.5)'}`,
                transform: 'rotate(-45deg)',
                transition: 'border-color 0.15s ease',
              }}
            />
            {/* AI label */}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '7px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: hovered ? 'var(--accent-cyan)' : 'rgba(0,229,255,0.55)',
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                transition: 'color 0.15s ease',
              }}
            >
              AI
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
