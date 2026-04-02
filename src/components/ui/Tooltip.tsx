'use client';

import * as RadixTooltip from '@radix-ui/react-tooltip';

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <RadixTooltip.Provider delayDuration={400}>{children}</RadixTooltip.Provider>;
}

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          style={{
            zIndex: 9999,
            padding: '5px 10px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-primary)',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-bright)',
            borderRadius: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            maxWidth: '240px',
            lineHeight: 1.5,
          }}
        >
          {content}
          <RadixTooltip.Arrow
            style={{ fill: 'var(--border-bright)' }}
            width={8}
            height={4}
          />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
