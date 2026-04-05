'use client';

/** Toggle switch for boolean values. Whole card is clickable. */
export function CheckboxField({
  value,
  onChange,
  label,
  description,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        background: value ? 'rgba(0,230,118,0.06)' : 'var(--bg-void)',
        border: `1px solid ${value ? 'rgba(0,230,118,0.35)' : 'var(--border-base)'}`,
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Toggle switch */}
      <div
        style={{
          width: '32px',
          height: '18px',
          borderRadius: '9px',
          background: value ? 'var(--accent-green)' : 'var(--border-base)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: 'var(--bg-void)',
            position: 'absolute',
            top: '2px',
            left: value ? '16px' : '2px',
            transition: 'left 0.15s',
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 600,
            color: value ? 'var(--text-bright)' : 'var(--text-primary)',
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '2px',
              lineHeight: '1.5',
            }}
          >
            {description}
          </div>
        )}
      </div>
    </button>
  );
}
