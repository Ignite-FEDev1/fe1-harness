'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

interface GenericTaskType { taskType: string; stageCount: number; }

const monoInput: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  background: 'var(--bg-void)',
  border: '1px solid var(--border-base)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
};

function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '12px 14px 6px', gap: '8px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
        {children}
      </span>
      {action}
    </div>
  );
}

export function PipelinesSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [specials, setSpecials] = useState<string[]>([]);
  const [genericTaskTypes, setGenericTaskTypes] = useState<GenericTaskType[]>([]);
  const [expandedGeneric, setExpandedGeneric] = useState<Record<string, string[]>>({});

  // new special form state
  const [showNewSpecial, setShowNewSpecial] = useState(false);
  const [newSpecialName, setNewSpecialName] = useState('');
  const [creatingSpecial, setCreatingSpecial] = useState(false);

  // new generic form state
  const [showNewGeneric, setShowNewGeneric] = useState(false);
  const [newGenericName, setNewGenericName] = useState('');
  const [creatingGeneric, setCreatingGeneric] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/pipelines');
    const data = await res.json();
    setSpecials(data.specials ?? []);
    setGenericTaskTypes(data.genericTaskTypes ?? []);
  }, []);

  // Fetch on mount + whenever pathname changes (to pick up deletes)
  useEffect(() => { fetchData(); }, [pathname, fetchData]);

  // Auto-expand pipeline whose stage is currently active
  useEffect(() => {
    const match = pathname.match(/^\/pipelines\/generic\/([^/]+)\/(.+)$/);
    if (!match) return;
    const name = match[1];
    if (expandedGeneric[name]) return;
    // Fetch stages for this pipeline
    fetch(`/api/pipelines/generic/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(data => {
        const stages = (data.stages ?? []).map((s: { id: string }) => s.id);
        setExpandedGeneric(prev => ({ ...prev, [name]: stages }));
      })
      .catch(() => {});
  }, [pathname]); // eslint-disable-line

  const toggleExpand = async (name: string) => {
    if (expandedGeneric[name]) {
      setExpandedGeneric(prev => { const n = { ...prev }; delete n[name]; return n; });
      return;
    }
    const res = await fetch(`/api/pipelines/generic/${encodeURIComponent(name)}`);
    const data = await res.json();
    const stages = (data.stages ?? []).map((s: { id: string }) => s.id);
    setExpandedGeneric(prev => ({ ...prev, [name]: stages }));
  };

  const createSpecial = async () => {
    const name = newSpecialName.trim();
    if (!name) return;
    setCreatingSpecial(true);
    await fetch('/api/specials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setCreatingSpecial(false);
    setShowNewSpecial(false);
    setNewSpecialName('');
    router.push(`/pipelines/specials/${encodeURIComponent(name)}`);
  };

  const createGeneric = async () => {
    const name = newGenericName.trim();
    if (!name) return;
    setCreatingGeneric(true);
    await fetch('/api/pipelines/generic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskType: name, stages: [] }) });
    setCreatingGeneric(false);
    setShowNewGeneric(false);
    setNewGenericName('');
    router.push(`/pipelines/generic/${encodeURIComponent(name)}`);
  };

  const deleteGenericPipeline = async (taskType: string) => {
    if (!confirm(`"${taskType}" 파이프라인을 삭제할까요?\n이 파이프라인을 참조하는 특수 규칙에서도 연결이 해제됩니다.`)) return;
    await fetch(`/api/pipelines/generic/${encodeURIComponent(taskType)}`, { method: 'DELETE' });
    setExpandedGeneric(prev => { const n = { ...prev }; delete n[taskType]; return n; });
    router.push('/pipelines');
  };

  // active state helpers
  const isGlobalRulesActive = () => pathname === '/pipelines/global-rules';
  const isOrchestratorActive = () => pathname === '/pipelines/orchestrator';
  const isSpecialActive = (name: string) => pathname === `/pipelines/specials/${name}`;
  const isPipelineActive = (name: string) => pathname === `/pipelines/generic/${name}`;
  const isStageActive = (name: string, stage: string) => pathname === `/pipelines/generic/${name}/${stage}`;

  return (
    <>
      {/* ── 시스템 ── */}
      <div style={{ padding: '10px 8px 4px' }}>
        <Link
          href="/pipelines/global-rules"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 8px',
            borderRadius: '4px',
            background: isGlobalRulesActive() ? 'rgba(0,230,118,0.08)' : 'transparent',
            border: `1px solid ${isGlobalRulesActive() ? 'rgba(0,230,118,0.25)' : 'transparent'}`,
            textDecoration: 'none',
            transition: 'all 0.1s',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)', letterSpacing: '0.08em' }}>📋 GLOBAL RULES</span>
        </Link>
        <Link
          href="/pipelines/orchestrator"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 8px',
            borderRadius: '4px',
            background: isOrchestratorActive() ? 'rgba(251,146,60,0.1)' : 'transparent',
            border: `1px solid ${isOrchestratorActive() ? 'rgba(251,146,60,0.3)' : 'transparent'}`,
            textDecoration: 'none',
            transition: 'all 0.1s',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: '#fb923c', letterSpacing: '0.08em' }}>⚙ ORCHESTRATOR</span>
        </Link>
      </div>

      <div style={{ height: '1px', background: 'var(--border-dim)' }} />

      {/* ── 특수 규칙 ── */}
      <SectionHeader
        action={
          <button
            onClick={() => setShowNewSpecial((v) => !v)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-green)', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '3px', padding: '2px 7px', cursor: 'pointer' }}
          >
            + 추가
          </button>
        }
      >
        특수 규칙
      </SectionHeader>

      {showNewSpecial && (
        <div className="flex gap-2" style={{ margin: '0 10px 6px' }}>
          <input
            placeholder="이름 (예: groupware, cpo)"
            value={newSpecialName}
            onChange={(e) => setNewSpecialName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createSpecial()}
            style={{ ...monoInput, fontSize: '12px', flex: 1 }}
            autoFocus
          />
          <button
            onClick={createSpecial}
            disabled={creatingSpecial || !newSpecialName.trim()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--bg-void)', background: 'var(--accent-green)', border: 'none', borderRadius: '4px', padding: '5px 10px', opacity: (creatingSpecial || !newSpecialName.trim()) ? 0.4 : 1, cursor: 'pointer', flexShrink: 0 }}
          >
            {creatingSpecial ? '...' : '생성'}
          </button>
        </div>
      )}

      <div style={{ padding: '0 8px 8px' }}>
        {specials.length === 0 ? (
          <div style={{ padding: '6px 6px', opacity: 0.5 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>등록된 특수 규칙 없음</span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {specials.map((name) => {
              const active = isSpecialActive(name);
              return (
                <Link
                  key={name}
                  href={`/pipelines/specials/${encodeURIComponent(name)}`}
                  style={{ textAlign: 'left', padding: '6px 8px', borderRadius: '4px', background: active ? 'rgba(0,230,118,0.08)' : 'transparent', border: `1px solid ${active ? 'rgba(0,230,118,0.25)' : 'transparent'}`, transition: 'all 0.1s', cursor: 'pointer', display: 'block', textDecoration: 'none' }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? 'var(--accent-green)' : 'var(--text-primary)' }}>{name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: '1px', background: 'var(--border-dim)' }} />

      {/* ── 파이프라인 ── */}
      <SectionHeader
        action={
          <button
            onClick={() => setShowNewGeneric((v) => !v)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '3px', padding: '2px 7px', cursor: 'pointer' }}
          >
            + 추가
          </button>
        }
      >
        파이프라인
      </SectionHeader>

      {showNewGeneric && (
        <div className="flex gap-2" style={{ margin: '0 10px 6px' }}>
          <input
            placeholder="이름 (예: 내부검토, 데이터분석)"
            value={newGenericName}
            onChange={(e) => setNewGenericName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createGeneric()}
            style={{ ...monoInput, fontSize: '12px', flex: 1 }}
            autoFocus
          />
          <button
            onClick={createGeneric}
            disabled={creatingGeneric || !newGenericName.trim()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--bg-void)', background: 'var(--accent-cyan)', border: 'none', borderRadius: '4px', padding: '5px 10px', opacity: (creatingGeneric || !newGenericName.trim()) ? 0.4 : 1, cursor: 'pointer', flexShrink: 0 }}
          >
            {creatingGeneric ? '...' : '생성'}
          </button>
        </div>
      )}

      <div style={{ padding: '0 8px 16px' }}>
        {genericTaskTypes.length === 0 ? (
          <div style={{ padding: '6px 6px', opacity: 0.5 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>파이프라인 없음</span>
          </div>
        ) : (
          genericTaskTypes.map((gt) => {
            const expanded = !!expandedGeneric[gt.taskType];
            const stages = expandedGeneric[gt.taskType] ?? [];
            const configActive = isPipelineActive(gt.taskType);

            return (
              <div key={gt.taskType} style={{ marginBottom: '4px' }}>
                {/* Task type header */}
                <div className="flex items-center" style={{ borderRadius: '4px', background: configActive ? 'rgba(0,229,255,0.06)' : 'transparent', border: `1px solid ${configActive ? 'rgba(0,229,255,0.2)' : 'transparent'}`, transition: 'all 0.1s' }}>
                  {/* Expand/collapse */}
                  <button
                    onClick={() => toggleExpand(gt.taskType)}
                    style={{ flex: 1, textAlign: 'left', padding: '6px 8px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', transition: 'transform 0.15s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none', lineHeight: 1, flexShrink: 0 }}>▶</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: configActive ? 'var(--accent-cyan)' : 'var(--text-primary)', flex: 1 }}>{gt.taskType}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{gt.stageCount}단계</span>
                  </button>
                  {/* Edit config link */}
                  <Link
                    href={`/pipelines/generic/${encodeURIComponent(gt.taskType)}`}
                    title="파이프라인 구성 편집"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: configActive ? 'var(--accent-cyan)' : 'var(--text-secondary)', background: 'transparent', border: 'none', padding: '4px 6px', cursor: 'pointer', flexShrink: 0, textDecoration: 'none' }}
                  >
                    편집
                  </Link>
                  {/* Delete button */}
                  <button
                    onClick={() => deleteGenericPipeline(gt.taskType)}
                    title="파이프라인 삭제"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#f87171', background: 'transparent', border: 'none', padding: '4px 6px', cursor: 'pointer', flexShrink: 0, marginRight: '2px' }}
                  >
                    ×
                  </button>
                </div>

                {/* Stage list */}
                {expanded && (
                  <div className="flex flex-col gap-0.5" style={{ paddingLeft: '20px', paddingBottom: '4px' }}>
                    {stages.map((stage) => {
                      const active = isStageActive(gt.taskType, stage);
                      return (
                        <Link
                          key={stage}
                          href={`/pipelines/generic/${encodeURIComponent(gt.taskType)}/${encodeURIComponent(stage)}`}
                          style={{ textAlign: 'left', padding: '5px 8px', borderRadius: '4px', background: active ? 'rgba(0,229,255,0.08)' : 'transparent', border: `1px solid ${active ? 'rgba(0,229,255,0.2)' : 'transparent'}`, transition: 'all 0.1s', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textDecoration: 'none' }}
                        >
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)', letterSpacing: '0.04em', flex: 1 }}>{stage}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
