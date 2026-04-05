'use client';

export interface GenStage {
  id: string;
  label?: string;
  parallel?: string;  // input field name whose array drives parallel execution (runtime N)
  fanout?: number;    // fixed number of parallel sub-agents (design-time N)
}

export const monoInput: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  background: 'var(--bg-void)',
  border: '1px solid var(--border-base)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
};

/**
 * Pipeline stage viewer.
 *
 * - 구조(순서, 병렬 필드, 추가/삭제)는 read-only — AI 어시스턴트로만 수정
 * - label만 직접 편집 가능 (안전한 필드)
 */
export function GenStageEditor({ stages, onChange }: { stages: GenStage[]; onChange: (s: GenStage[]) => void }) {
  const updateLabel = (idx: number, label: string) =>
    onChange(stages.map((s, i) => (i === idx ? { ...s, label: label || undefined } : s)));

  if (stages.length === 0) {
    return (
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0', border: '1px dashed var(--border-dim)', borderRadius: '6px' }}>
        스테이지가 없습니다. AI 어시스턴트를 통해 추가하세요.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {stages.map((stage, idx) => {
        const isParallel = !!stage.parallel || !!stage.fanout;

        return (
          <div
            key={`${stage.id}-${idx}`}
            className="flex items-center gap-0"
            style={{
              background: isParallel ? 'rgba(139,92,246,0.06)' : 'var(--bg-raised)',
              border: `1px solid ${isParallel ? 'rgba(139,92,246,0.25)' : 'var(--border-dim)'}`,
              borderLeft: isParallel ? '3px solid rgba(139,92,246,0.6)' : '3px solid rgba(0,229,255,0.3)',
              borderRadius: '6px',
              padding: '8px 12px',
            }}
          >
            {/* Order number */}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                width: '24px',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </span>

            {/* Stage ID (read-only) */}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 600,
                color: isParallel ? '#a78bfa' : 'var(--accent-cyan)',
                minWidth: '100px',
                flexShrink: 0,
              }}
            >
              {stage.id}
            </span>

            {/* Label (editable — 항상 input으로 보임) */}
            <input
              placeholder="레이블 입력"
              value={stage.label ?? ''}
              onChange={(e) => updateLabel(idx, e.target.value)}
              style={{
                ...monoInput,
                flex: 1,
                fontSize: '12px',
                padding: '3px 7px',
              }}
            />

            {/* Execution type badge (read-only) */}
            {isParallel ? (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: '#a78bfa',
                  background: 'rgba(139,92,246,0.12)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                title={stage.parallel
                  ? `입력 필드 "${stage.parallel}"의 항목 수만큼 병렬 실행`
                  : `${stage.fanout}개의 독립 Agent를 병렬 실행`}
              >
                ↻ 병렬 · {stage.parallel ?? `${stage.fanout}개`}
              </span>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: 'var(--text-muted)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                순차
              </span>
            )}
          </div>
        );
      })}

      {/* Hint */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginTop: '4px',
          lineHeight: '1.5',
        }}
      >
        순서 변경, 병렬 설정, 스테이지 추가·삭제는 <span style={{ color: 'var(--accent-cyan)' }}>AI 어시스턴트</span>를 이용하세요.
      </div>
    </div>
  );
}
