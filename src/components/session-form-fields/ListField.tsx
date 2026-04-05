'use client';

/** Dynamic list of text/URL inputs with add/remove controls. */
export function ListField({
  value,
  onChange,
  placeholder,
  type,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  type: 'text-list' | 'url-list';
}) {
  const addItem = () => onChange([...value, '']);
  const updateItem = (i: number, v: string) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  const removeItem = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const inputType = type === 'url-list' ? 'url' : 'text';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {value.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type={inputType}
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder={placeholder}
            className="input-field input-mono"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            style={{
              width: '28px',
              height: '28px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              border: '1px solid var(--border-base)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          padding: '5px 10px',
          borderRadius: '4px',
          border: '1px dashed var(--border-base)',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        + 항목 추가
      </button>
    </div>
  );
}
