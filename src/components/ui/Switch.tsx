'use client';

import * as RadixSwitch from '@radix-ui/react-switch';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ checked, onCheckedChange, disabled }: SwitchProps) {
  return (
    <>
      <style>{`
        .ui-switch-thumb[data-state="checked"] { transform: translateX(19px); }
        .ui-switch-thumb[data-state="unchecked"] { transform: translateX(3px); }
        .ui-switch-root[data-state="checked"] { background: var(--accent-green); }
        .ui-switch-root[data-state="unchecked"] { background: var(--border-base); }
      `}</style>
      <RadixSwitch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="ui-switch-root"
        style={{
          width: '36px',
          height: '20px',
          borderRadius: '10px',
          border: 'none',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.2s',
          outline: 'none',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <RadixSwitch.Thumb
          className="ui-switch-thumb"
          style={{
            display: 'block',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: 'var(--bg-void)',
            transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
            willChange: 'transform',
          }}
        />
      </RadixSwitch.Root>
    </>
  );
}
