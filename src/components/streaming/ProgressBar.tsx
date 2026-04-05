'use client';

export interface PipelineStage {
  id: string;
  label: string;
  parallel?: string;
  fanout?: number;
}

interface ProgressBarProps {
  stages: PipelineStage[];
  activeStageId: string | null;
  allCompleted?: boolean;
}

export function ProgressBar({ stages, activeStageId, allCompleted = false }: ProgressBarProps) {
  if (stages.length === 0) return null;

  const activeIndex = activeStageId ? stages.findIndex((s) => s.id === activeStageId) : -1;

  return (
    <div
      className="flex items-center px-5 py-3"
      style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-dim)' }}
    >
      {stages.map((stage, i) => {
        const isCompleted = allCompleted || (activeIndex > -1 && i < activeIndex);
        const isActive = !allCompleted && stage.id === activeStageId;
        const isPending = !isCompleted && !isActive;

        return (
          <div key={stage.id} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-sm flex items-center justify-center flex-shrink-0 transition-all ${isActive ? 'status-pulse' : ''}`}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: isCompleted
                    ? 'var(--accent-cyan)'
                    : isActive
                      ? 'var(--accent-green)'
                      : 'var(--bg-surface)',
                  color: isCompleted || isActive ? 'var(--bg-void)' : 'var(--text-muted)',
                  border: isPending ? '1px solid var(--border-base)' : 'none',
                  boxShadow: isActive ? '0 0 12px var(--accent-green-glow)' : 'none',
                }}
              >
                {isCompleted ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <span
                  className="truncate"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 400,
                    color: isCompleted
                      ? 'var(--accent-cyan)'
                      : isActive
                        ? 'var(--accent-green)'
                        : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stage.label}
                </span>
                {(stage.parallel || stage.fanout) && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#a78bfa', whiteSpace: 'nowrap' }}>
                    ↻ ×{stage.parallel ?? `${stage.fanout}`}
                  </span>
                )}
              </div>
            </div>

            {i < stages.length - 1 && (
              <div className="flex-1 mx-2 h-px relative">
                <div className="absolute inset-0" style={{ background: 'var(--border-dim)' }} />
                {isCompleted && <div className="absolute inset-0" style={{ background: 'var(--accent-cyan)', opacity: 0.5 }} />}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1/2" style={{ background: 'linear-gradient(90deg, var(--accent-green), transparent)', opacity: 0.4 }} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
