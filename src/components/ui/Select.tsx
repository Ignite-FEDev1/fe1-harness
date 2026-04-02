'use client';

import * as RadixSelect from '@radix-ui/react-select';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}

export function Select({ value, onChange, options, placeholder = '선택', disabled }: SelectProps) {
  return (
    <RadixSelect.Root value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          padding: '6px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          background: 'var(--bg-void)',
          border: '1px solid var(--border-base)',
          borderRadius: '4px',
          outline: 'none',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-bright)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-base)'; }}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronIcon />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          style={{
            zIndex: 9999,
            minWidth: 'var(--radix-select-trigger-width)',
            maxHeight: '280px',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-bright)',
            borderRadius: '6px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <RadixSelect.ScrollUpButton style={{ display: 'flex', justifyContent: 'center', padding: '4px', color: 'var(--text-muted)' }}>
            <UpIcon />
          </RadixSelect.ScrollUpButton>

          <RadixSelect.Viewport style={{ padding: '4px' }}>
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  outline: 'none',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onFocus={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
                onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator>
                  <CheckIcon />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>

          <RadixSelect.ScrollDownButton style={{ display: 'flex', justifyContent: 'center', padding: '4px', color: 'var(--text-muted)' }}>
            <DownIcon />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

function ChevronIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
      <path d="M1 1l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
      <path d="M1 5l3.5 3.5L11 1" stroke="var(--accent-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UpIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
      <path d="M9 5L5 1 1 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownIcon() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
