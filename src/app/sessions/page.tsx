export default function SessionsPage() {
  return (
    <div className="flex items-center justify-center h-full grid-pattern">
      <div className="text-center">
        <div
          className="w-12 h-12 mx-auto mb-4 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-base)' }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--text-muted)' }}>
            <path d="M3 4h14M3 8h14M3 12h10M3 16h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
          세션을 선택하거나 새로 만들어보세요
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          SELECT A SESSION OR CREATE NEW
        </p>
      </div>
    </div>
  );
}
