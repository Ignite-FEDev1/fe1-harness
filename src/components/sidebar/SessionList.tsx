'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSessionList } from '@/hooks/useSessionList';

const STATUS_COLORS: Record<string, { dot: string; glow: string; label: string }> = {
  idle: { dot: 'var(--text-muted)', glow: 'transparent', label: 'IDLE' },
  running: { dot: 'var(--accent-green)', glow: 'var(--accent-green)', label: 'RUN' },
  paused: { dot: 'var(--accent-amber)', glow: 'var(--accent-amber)', label: 'WAIT' },
  completed: { dot: 'var(--accent-cyan)', glow: 'transparent', label: 'DONE' },
  error: { dot: 'var(--accent-red)', glow: 'var(--accent-red)', label: 'ERR' },
  stopped: { dot: 'var(--accent-amber)', glow: 'transparent', label: 'STOP' },
};

export function SessionList() {
  const { sessions, loading, refresh } = useSessionList();
  const params = useParams();
  const router = useRouter();
  const activeId = params?.id as string | undefined;

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    if (activeId === sessionId) {
      router.push('/sessions');
    }
    refresh();
  };

  if (loading) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
        LOADING...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        세션이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col py-1">
      {sessions.map((session) => {
        const isActive = activeId === session.id;
        const status = STATUS_COLORS[session.status] ?? STATUS_COLORS.idle;
        const isRunning = session.status === 'running';

        return (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="flex items-center gap-2.5 px-4 py-2.5 transition-all relative group"
            style={{
              background: isActive ? 'var(--bg-surface)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent-green)' : '2px solid transparent',
            }}
          >
            {/* Status indicator */}
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isRunning ? 'status-pulse' : ''}`}
              style={{
                background: status.dot,
                boxShadow: status.glow !== 'transparent' ? `0 0 6px ${status.glow}` : 'none',
              }}
            />

            {/* Session info */}
            <div className="flex-1 min-w-0">
              <div
                className="text-xs truncate"
                style={{ color: isActive ? 'var(--text-bright)' : 'var(--text-primary)', fontWeight: isActive ? 500 : 400 }}
              >
                {session.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {session.projects?.name && (
                  <span className="text-xs truncate" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {session.projects.name}
                  </span>
                )}
              </div>
            </div>

            {/* Status badge */}
            <span
              className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                color: status.dot,
                background: `color-mix(in srgb, ${status.dot} 8%, transparent)`,
              }}
            >
              {status.label}
            </span>

            {/* Delete button — shown on hover */}
            <button
              onClick={(e) => handleDelete(e, session.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              style={{
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '3px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
              title="세션 삭제"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </Link>
        );
      })}
    </div>
  );
}
