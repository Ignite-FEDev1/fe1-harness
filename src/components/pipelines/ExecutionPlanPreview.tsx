'use client';

interface GenStage {
  id: string;
  label?: string;
  parallel?: string;
  fanout?: number;
}

export function ExecutionPlanPreview({ stages }: { stages: GenStage[] }) {
  return (
    <div className="flex items-start gap-2" style={{ flexWrap: 'wrap' }}>
      {stages.map((stage, idx) => {
        const isParallel = !!stage.parallel || !!stage.fanout;
        const parallelText = stage.parallel ?? (stage.fanout ? `${stage.fanout}개` : '');
        return (
        <div key={stage.id} className="flex items-center gap-2">
          <div style={{
            background: isParallel ? 'rgba(139,92,246,0.08)' : 'var(--bg-overlay)',
            border: `1px solid ${isParallel ? 'rgba(139,92,246,0.35)' : 'var(--border-base)'}`,
            borderRadius: '6px',
            padding: '6px 10px',
          }}>
            {isParallel && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#a78bfa', marginBottom: '3px', letterSpacing: '0.06em' }}>
                ↻ 병렬 × {parallelText}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: isParallel ? '#a78bfa' : 'var(--accent-cyan)' }}>{stage.id}</span>
              {stage.label && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>· {stage.label}</span>}
            </div>
          </div>
          {idx < stages.length - 1 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--border-base)' }}>→</span>
          )}
        </div>
        );
      })}
    </div>
  );
}
