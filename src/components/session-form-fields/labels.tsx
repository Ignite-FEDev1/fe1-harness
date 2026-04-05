import type { ReactNode } from 'react';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  color: 'var(--text-secondary)',
  marginBottom: '6px',
};

/** Label for a required/optional input field (shown above the input). */
export function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label style={labelStyle}>
      {children}
      {required && <span style={{ color: 'var(--accent-green)', marginLeft: '4px' }}>*</span>}
    </label>
  );
}

/** Label with optional "선택" hint for legacy form fields. */
export function FormLabel({ children, optional }: { children: ReactNode; optional?: boolean }) {
  return (
    <label style={labelStyle}>
      {children}
      {optional && (
        <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>선택</span>
      )}
    </label>
  );
}
