'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, API_MODE_META, MODEL_OPTIONS } from '@/contexts/UserContext';

const NAV_LINKS = [
  { href: '/sessions', label: 'SESSIONS' },
  { href: '/chat', label: 'CHAT' },
  { href: '/pipelines', label: 'PIPELINES' },
  { href: '/test', label: 'TEST' },
  { href: '/admin', label: 'ADMIN' },
] as const;

const MODE_COLORS: Record<string, { active: string; bg: string; glow: string; text: string }> = {
  'h-chat':     { active: '#ffab00', bg: 'rgba(255,171,0,0.15)',  glow: 'rgba(255,171,0,0.35)',  text: '#ffab00' },
  'claude-max': { active: '#00e676', bg: 'rgba(0,230,118,0.15)', glow: 'rgba(0,230,118,0.35)', text: '#00e676' },
  'anthropic':  { active: '#00e5ff', bg: 'rgba(0,229,255,0.15)', glow: 'rgba(0,229,255,0.35)', text: '#00e5ff' },
};

export function AppHeader() {
  const pathname = usePathname();
  const { selectedUser, apiMode, setApiMode, availableModes, currentModel, setModelForMode } = useUser();

  return (
    <header
      className="flex items-center justify-between flex-shrink-0"
      style={{
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-base)',
        padding: '0 20px',
        height: '48px',
      }}
    >
      {/* ── Logo ── */}
      <Link
        href="/sessions"
        className="flex items-center gap-2.5"
        style={{ textDecoration: 'none' }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'var(--accent-green)',
            boxShadow: '0 0 10px var(--accent-green), 0 0 20px rgba(0,230,118,0.3)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: 'var(--text-bright)',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.1em',
          }}
        >
          FE1:HARNESS
        </span>
        <span
          style={{
            color: 'var(--accent-green)',
            background: 'rgba(0,230,118,0.08)',
            border: '1px solid rgba(0,230,118,0.25)',
            borderRadius: '3px',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            padding: '2px 6px',
          }}
        >
          PIPELINE
        </span>
      </Link>

      <div className="flex items-center" style={{ gap: '6px' }}>

        {/* ── API Mode Toggle ── */}
        <div
          className="flex items-center"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-bright)',
            borderRadius: '5px',
            overflow: 'hidden',
            marginRight: '10px',
          }}
        >
          {availableModes.map((mode, i) => {
            const active = apiMode === mode;
            const colors = MODE_COLORS[mode] ?? { active: 'var(--text-bright)', bg: 'rgba(255,255,255,0.1)', glow: 'transparent', text: 'var(--text-bright)' };
            return (
              <button
                key={mode}
                onClick={() => setApiMode(mode)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '0.08em',
                  padding: '5px 11px',
                  color: active ? '#0a0f16' : colors.text,
                  background: active ? colors.active : 'transparent',
                  boxShadow: active ? `0 0 12px ${colors.glow}` : 'none',
                  borderRight: i < availableModes.length - 1 ? '1px solid var(--border-base)' : 'none',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  opacity: active ? 1 : 0.75,
                }}
              >
                {API_MODE_META[mode].label}
              </button>
            );
          })}
        </div>

        {/* ── Model Selector ── */}
        <select
          value={currentModel}
          onChange={(e) => setModelForMode(apiMode, e.target.value)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            padding: '4px 8px',
            paddingRight: '22px',
            color: 'var(--text-primary)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-bright)',
            borderRadius: '5px',
            outline: 'none',
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: 'pointer',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23556677' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 6px center',
            marginRight: '2px',
          }}
        >
          {MODEL_OPTIONS[apiMode].map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              style={{ background: '#0f1923', color: '#c9d5e0' }}
            >
              {opt.label}
            </option>
          ))}
        </select>

        {/* ── Nav Links ── */}
        {NAV_LINKS.map(({ href, label }) => {
          const isActive =
            pathname === href ||
            (href !== '/sessions' && pathname.startsWith(href + '/')) ||
            (href === '/sessions' && pathname.startsWith('/sessions'));
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.07em',
                padding: '5px 12px',
                borderRadius: '4px',
                textDecoration: 'none',
                color: isActive ? 'var(--accent-green)' : 'var(--text-primary)',
                background: isActive ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.04)',
                border: isActive
                  ? '1px solid rgba(0,230,118,0.4)'
                  : '1px solid var(--border-bright)',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </Link>
          );
        })}

        {/* ── Divider ── */}
        <div
          style={{
            width: '1px',
            height: '20px',
            background: 'var(--border-bright)',
            margin: '0 4px',
          }}
        />

        {/* ── User Badge → admin ── */}
        <Link href="/admin" style={{ textDecoration: 'none' }}>
          {selectedUser ? (
            <span
              className="flex items-center gap-1.5"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-bright)',
                borderRadius: '4px',
                padding: '4px 10px',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--accent-green)',
                  flexShrink: 0,
                }}
              />
              {selectedUser.name}
            </span>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                color: '#ffab00',
                background: 'rgba(255,171,0,0.1)',
                border: '1px solid rgba(255,171,0,0.35)',
                borderRadius: '4px',
                padding: '4px 10px',
                whiteSpace: 'nowrap',
              }}
            >
              NO OPERATOR
            </span>
          )}
        </Link>

      </div>
    </header>
  );
}
