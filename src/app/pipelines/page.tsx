export default function PipelinesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
      <div style={{ width: '40px', height: '40px', border: '2px solid var(--border-dim)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--border-base)', fontSize: '18px' }}>⚙</span>
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
        왼쪽에서 파이프라인 또는 특수 규칙을 선택하세요
      </p>
    </div>
  );
}
