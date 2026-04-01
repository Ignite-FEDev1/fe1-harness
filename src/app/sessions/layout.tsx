'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SessionList } from '@/components/sidebar/SessionList';
import { SessionForm } from '@/components/session-form/SessionForm';
import { AppHeader } from '@/components/layout/AppHeader';

export default function SessionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-void)' }}>
      <AppHeader />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="w-72 flex flex-col flex-shrink-0"
          style={{ background: 'var(--bg-base)', borderRight: '1px solid var(--border-dim)' }}
        >
          <div
            style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-dim)', flexShrink: 0 }}
          >
            <button
              onClick={() => setShowForm(true)}
              style={{
                width: '100%',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '7px 14px',
                borderRadius: '5px',
                background: 'var(--accent-green)',
                color: 'var(--bg-void)',
                border: 'none',
                boxShadow: '0 0 12px rgba(0,230,118,0.2)',
              }}
            >
              + NEW SESSION
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            <SessionList />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>

      {/* Session Form Modal */}
      <SessionForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onCreated={(id) => {
          router.push(`/sessions/${id}`);
        }}
      />
    </div>
  );
}
