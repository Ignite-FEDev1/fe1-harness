'use client';

export interface PipelineStage {
  id: string;
  label: string;
  parallelGroup?: string;
}

interface ProgressBarProps {
  stages: PipelineStage[];
  activeStageId: string | null;
  allCompleted?: boolean;
}

export function ProgressBar({ stages, activeStageId, allCompleted = false }: ProgressBarProps) {
  if (stages.length === 0) return null;

  // When pipeline is fully completed, show all stages as completed
  if (allCompleted) {
    return (
      <div
        className="flex items-center px-5 py-3"
        style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-dim)' }}
      >
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-6 h-6 rounded-sm flex items-center justify-center flex-shrink-0"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: 'var(--accent-cyan)',
                  color: 'var(--bg-void)',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span
                className="truncate"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: 'var(--accent-cyan)',
                  whiteSpace: 'nowrap',
                }}
              >
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className="flex-1 mx-2 h-px relative">
                <div className="absolute inset-0" style={{ background: 'var(--accent-cyan)', opacity: 0.5 }} />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Find parallelGroup of the active stage (if any)
  const activeStage = activeStageId ? stages.find((s) => s.id === activeStageId) : null;
  const activeGroup = activeStage?.parallelGroup ?? null;

  // A stage is "active" if it's the active stage itself OR shares the same parallelGroup
  const isStageActive = (stage: PipelineStage) => {
    if (stage.id === activeStageId) return true;
    if (activeGroup && stage.parallelGroup === activeGroup) return true;
    return false;
  };

  // Determine completed stages: all stages before the first active stage in the sequence
  const activeIndex = activeStageId ? stages.findIndex((s) => s.id === activeStageId) : -1;
  // For parallel groups, use the earliest index in the group
  const activeGroupFirstIndex =
    activeGroup !== null
      ? stages.findIndex((s) => s.parallelGroup === activeGroup)
      : activeIndex;
  const effectiveActiveIndex = activeGroupFirstIndex > -1 ? activeGroupFirstIndex : activeIndex;

  // For step number display: collapse parallel groups into single visual slots
  // Build a map: stageId → visual step number (parallel siblings share same number)
  const visualStepMap = new Map<string, number>();
  let stepNum = 0;
  let lastGroup: string | null = null;
  for (const stage of stages) {
    const group = stage.parallelGroup ?? null;
    if (group !== null && group === lastGroup) {
      // Same parallel group as previous — reuse same step number
      visualStepMap.set(stage.id, stepNum);
    } else {
      stepNum += 1;
      visualStepMap.set(stage.id, stepNum);
      lastGroup = group;
    }
  }

  return (
    <div
      className="flex items-center px-5 py-3"
      style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-dim)' }}
    >
      {stages.map((stage, i) => {
        const active = isStageActive(stage);
        const isCompleted = effectiveActiveIndex > -1 && i < effectiveActiveIndex;
        const isPending = !active && !isCompleted;
        const visualStep = visualStepMap.get(stage.id) ?? i + 1;

        // Hide connector between two stages in the same parallel group
        const nextStage = stages[i + 1];
        const isParallelSibling =
          stage.parallelGroup !== undefined &&
          nextStage?.parallelGroup === stage.parallelGroup;

        return (
          <div key={stage.id} className="flex items-center flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              {/* Step indicator */}
              <div
                className={`w-6 h-6 rounded-sm flex items-center justify-center flex-shrink-0 transition-all ${active ? 'status-pulse' : ''}`}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: isCompleted
                    ? 'var(--accent-cyan)'
                    : active
                      ? 'var(--accent-green)'
                      : 'var(--bg-surface)',
                  color: isCompleted || active
                    ? 'var(--bg-void)'
                    : 'var(--text-muted)',
                  border: isPending ? '1px solid var(--border-base)' : 'none',
                  boxShadow: active ? '0 0 12px var(--accent-green-glow)' : 'none',
                }}
              >
                {isCompleted ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  visualStep
                )}
              </div>

              {/* Label */}
              <span
                className="truncate"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 400,
                  color: isCompleted
                    ? 'var(--accent-cyan)'
                    : active
                      ? 'var(--accent-green)'
                      : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {stage.label}
              </span>
            </div>

            {/* Connector line */}
            {i < stages.length - 1 && (
              <div
                className="flex-1 mx-2 h-px relative"
                style={isParallelSibling ? { maxWidth: '8px' } : {}}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: isParallelSibling ? 'var(--accent-green)' : 'var(--border-dim)',
                    opacity: isParallelSibling ? 0.4 : 1,
                  }}
                />
                {isCompleted && !isParallelSibling && (
                  <div
                    className="absolute inset-0"
                    style={{ background: 'var(--accent-cyan)', opacity: 0.5 }}
                  />
                )}
                {active && !isParallelSibling && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1/2"
                    style={{
                      background: 'linear-gradient(90deg, var(--accent-green), transparent)',
                      opacity: 0.4,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
