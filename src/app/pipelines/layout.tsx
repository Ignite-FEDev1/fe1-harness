import { AppHeader } from '@/components/layout/AppHeader';
import { PipelinesSidebar } from '@/components/pipelines/PipelinesSidebar';

export default function PipelinesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ height: '100vh', background: 'var(--bg-void)', overflow: 'hidden' }}>
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-shrink-0 overflow-y-auto" style={{ width: '260px', borderRight: '1px solid var(--border-dim)', background: 'var(--bg-base)' }}>
          <PipelinesSidebar />
        </div>
        <main className="flex flex-col flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
