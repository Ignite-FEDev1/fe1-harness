'use client';

/** Pill-button group for choosing one of multiple values. */
export function RadioField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: active ? 700 : 500,
              letterSpacing: '0.04em',
              padding: '7px 14px',
              borderRadius: '6px',
              border: active ? '1px solid var(--accent-green)' : '1px solid var(--border-base)',
              background: active ? 'rgba(0,230,118,0.1)' : 'var(--bg-void)',
              color: active ? 'var(--accent-green)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
