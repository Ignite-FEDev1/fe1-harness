'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';

const ORDERED_STAGES = [
  'plan', 'plan-review', 'ticket', 'ticket-review',
  'develop', 'develop-review', 'pr', 'qa', 'qa-review',
] as const;

const STAGE_LABELS: Record<string, string> = {
  'plan': '기획 분석',
  'plan-review': '계획서 검수',
  'ticket': '티켓 생성',
  'ticket-review': '티켓 검수',
  'develop': '개발',
  'develop-review': '코드 리뷰',
  'pr': 'PR 작성',
  'qa': 'QA',
  'qa-review': 'QA 검수',
};

// ── Types ──────────────────────────────────────────────────────────

interface GenStage {
  id: string;
  label?: string;
  parallelGroup?: string;
}

interface ProjectEntry {
  slug: string;
  taskType: string;
  label: string;
  enabledCount: number;
}

interface GenericTaskType {
  taskType: string;
  stageCount: number;
}

interface StageConfig {
  id: string;
  enabled: boolean;
}

interface Config {
  project: string;
  taskType: string;
  label: string;
  description: string;
  genericPipeline?: string;
  stages: StageConfig[];
}

type Selection =
  | { kind: 'project'; slug: string; taskType: string }
  | { kind: 'generic'; taskType: string; stage: string }
  | { kind: 'generic-config'; taskType: string };

// ── Helpers ─────────────────────────────────────────────────────────

function parallelGroupColor(group: string): string {
  const colors = ['#F59E0B', '#8B5CF6', '#EC4899', '#10B981', '#3B82F6'];
  let h = 0;
  for (const c of group) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

function sanitizeStageId(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
}

// ── Shared UI components ─────────────────────────────────────────────

function MonoLabel({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.08em', color: dim ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
      {children}
    </span>
  );
}

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

function StageToggle({ stage, enabled, onChange }: { stage: string; enabled: boolean; onChange: (v: boolean) => void }) {
  const label = STAGE_LABELS[stage] ?? stage;
  return (
    <div className="flex items-center justify-between" style={{ padding: '10px 14px', background: enabled ? 'rgba(0,230,118,0.04)' : 'var(--bg-raised)', border: `1px solid ${enabled ? 'rgba(0,230,118,0.2)' : 'var(--border-dim)'}`, borderRadius: '6px', transition: 'all 0.15s' }}>
      <div className="flex items-center gap-3">
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: enabled ? 'var(--accent-green)' : 'var(--border-base)', boxShadow: enabled ? '0 0 6px var(--accent-green)' : 'none', flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: enabled ? 'var(--text-primary)' : 'var(--text-muted)', letterSpacing: '0.04em' }}>{stage}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>{label}</div>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={onChange} />
    </div>
  );
}

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

const ctrlBtn: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12px',
  width: '22px',
  height: '22px',
  background: 'var(--bg-overlay)',
  border: '1px solid var(--border-base)',
  borderRadius: '3px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  flexShrink: 0,
};

// ── GenStage Editor (reused for create + edit) ───────────────────────

function GenStageEditor({ stages, onChange }: { stages: GenStage[]; onChange: (s: GenStage[]) => void }) {
  const [input, setInput] = useState('');

  const add = () => {
    const id = sanitizeStageId(input);
    if (!id || stages.some((s) => s.id === id)) return;
    onChange([...stages, { id }]);
    setInput('');
  };

  const update = (idx: number, patch: Partial<GenStage>) =>
    onChange(stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const remove = (idx: number) => onChange(stages.filter((_, i) => i !== idx));

  const move = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= stages.length) return;
    const arr = [...stages];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange(arr);
  };

  const hasParallel = stages.some((s) => s.parallelGroup);

  return (
    <div className="flex flex-col gap-2">
      {/* Add row */}
      <div className="flex gap-2">
        <input
          placeholder="스테이지 ID (예: research, analyze-ux)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          style={{ ...monoInput, flex: 1, fontSize: '12px' }}
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--bg-void)', background: 'var(--accent-cyan)', border: 'none', borderRadius: '4px', padding: '6px 14px', opacity: !input.trim() ? 0.4 : 1, cursor: 'pointer', flexShrink: 0 }}
        >
          + 추가
        </button>
      </div>

      {/* Column headers */}
      {stages.length > 0 && (
        <div className="flex gap-2 items-center" style={{ paddingLeft: '2px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', minWidth: '90px' }}>STAGE ID</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', width: '110px' }}>레이블 (선택)</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', width: '110px' }}>병렬그룹 (선택)</span>
        </div>
      )}

      {/* Stage rows */}
      {stages.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0', border: '1px dashed var(--border-dim)', borderRadius: '6px' }}>
          스테이지를 추가하세요
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {stages.map((stage, idx) => {
            const gc = stage.parallelGroup ? parallelGroupColor(stage.parallelGroup) : null;
            // Check if adjacent stages share the same group (for visual grouping)
            const prevGroup = idx > 0 ? stages[idx - 1].parallelGroup : undefined;
            const nextGroup = idx < stages.length - 1 ? stages[idx + 1].parallelGroup : undefined;
            const isGroupStart = gc && prevGroup !== stage.parallelGroup;
            const isGroupEnd = gc && nextGroup !== stage.parallelGroup;

            return (
              <div
                key={`${stage.id}-${idx}`}
                className="flex items-center gap-2"
                style={{
                  background: gc ? `${gc}0a` : 'var(--bg-raised)',
                  border: `1px solid ${gc ? `${gc}40` : 'var(--border-dim)'}`,
                  borderLeft: gc ? `3px solid ${gc}` : '1px solid var(--border-dim)',
                  borderRadius: isGroupStart && !isGroupEnd ? '6px 6px 2px 2px' : isGroupEnd && !isGroupStart ? '2px 2px 6px 6px' : !isGroupStart && !isGroupEnd && gc ? '2px' : '6px',
                  padding: '8px 10px',
                  marginBottom: isGroupEnd || !gc ? '2px' : '0',
                }}
              >
                {/* ID */}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: gc ?? 'var(--accent-cyan)', minWidth: '90px' }}>
                  {stage.id}
                </span>

                {/* Label input */}
                <input
                  placeholder="레이블"
                  value={stage.label ?? ''}
                  onChange={(e) => update(idx, { label: e.target.value || undefined })}
                  style={{ ...monoInput, width: '110px', fontSize: '12px', padding: '3px 7px' }}
                />

                {/* Parallel group input */}
                <input
                  placeholder="병렬그룹"
                  value={stage.parallelGroup ?? ''}
                  onChange={(e) => update(idx, { parallelGroup: e.target.value || undefined })}
                  style={{ ...monoInput, width: '110px', fontSize: '12px', padding: '3px 7px', borderColor: gc ?? undefined }}
                />

                {/* Controls */}
                <div className="flex gap-1 ml-auto">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ ...ctrlBtn, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                  <button onClick={() => move(idx, 1)} disabled={idx === stages.length - 1} style={{ ...ctrlBtn, opacity: idx === stages.length - 1 ? 0.3 : 1 }}>↓</button>
                  <button onClick={() => remove(idx)} style={{ ...ctrlBtn, color: '#f87171' }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Parallel hint */}
      {hasParallel && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
          ※ 같은 병렬그룹 이름을 가진 스테이지들은 독립된 에이전트로 동시에 실행됩니다
        </div>
      )}
    </div>
  );
}

function SaveButton({ saving, saveMsg, onSave, color }: { saving: boolean; saveMsg: string; onSave: () => void; color: string }) {
  return (
    <div className="flex items-center gap-2">
      {saveMsg && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-green)' }}>{saveMsg}</span>}
      <button onClick={onSave} disabled={saving} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', padding: '6px 16px', borderRadius: '4px', background: color, color: 'var(--bg-void)', border: 'none', opacity: saving ? 0.6 : 1, cursor: 'pointer' }}>
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px' }}>
      <div style={{ width: '40px', height: '40px', border: '2px solid var(--border-dim)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--border-base)', fontSize: '18px' }}>⚙</span>
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
        왼쪽에서 프로젝트 설정 또는 범용 파이프라인을 선택하세요
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function PipelinesPage() {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [genericTaskTypes, setGenericTaskTypes] = useState<GenericTaskType[]>([]);
  const [expandedGeneric, setExpandedGeneric] = useState<Record<string, boolean>>({});
  const [genericStages, setGenericStages] = useState<Record<string, string[]>>({});

  const [selection, setSelection] = useState<Selection | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [special, setSpecial] = useState('');
  const [projectTab, setProjectTab] = useState<'config' | 'special'>('config');
  const [genericContent, setGenericContent] = useState('');
  const [genPipelineConfig, setGenPipelineConfig] = useState<GenStage[]>([]);
  const [renamingGeneric, setRenamingGeneric] = useState(false);
  const [genericRenameValue, setGenericRenameValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // New project form
  const [showNewProject, setShowNewProject] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newTaskType, setNewTaskType] = useState('');
  const [creating, setCreating] = useState(false);

  // New generic pipeline form
  const [showNewGeneric, setShowNewGeneric] = useState(false);
  const [newGenericType, setNewGenericType] = useState('');
  const [newStages, setNewStages] = useState<GenStage[]>([]);
  const [creatingGeneric, setCreatingGeneric] = useState(false);

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/pipelines');
    const data = await res.json();
    setProjects(data.projects ?? []);
    setGenericTaskTypes(data.genericTaskTypes ?? []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleGenericExpand = useCallback(async (taskType: string) => {
    const next = !expandedGeneric[taskType];
    setExpandedGeneric((prev) => ({ ...prev, [taskType]: next }));

    if (next && !genericStages[taskType]) {
      const res = await fetch(`/api/pipelines/generic`);
      const data = await res.json();
      const found = (data.taskTypes ?? []).find((t: { taskType: string; stages: string[] }) => t.taskType === taskType);
      if (found) {
        setGenericStages((prev) => ({ ...prev, [taskType]: found.stages }));
      }
    }
  }, [expandedGeneric, genericStages]);

  const selectProject = useCallback(async (slug: string, taskType: string) => {
    setSelection({ kind: 'project', slug, taskType });
    setProjectTab('config');
    setLoading(true);
    const res = await fetch(`/api/pipelines/projects/${encodeURIComponent(slug)}/${encodeURIComponent(taskType)}`);
    const data = await res.json();
    setConfig(data.config);
    setSpecial(data.special);
    setLoading(false);
  }, []);

  const selectGenericStage = useCallback(async (taskType: string, stage: string) => {
    setSelection({ kind: 'generic', taskType, stage });
    setLoading(true);
    const res = await fetch(`/api/pipelines/generic/${encodeURIComponent(taskType)}/${encodeURIComponent(stage)}`);
    const data = await res.json();
    setGenericContent(data.content ?? '');
    setLoading(false);
  }, []);

  const selectGenericConfig = useCallback(async (taskType: string) => {
    setSelection({ kind: 'generic-config', taskType });
    setRenamingGeneric(false);
    setGenericRenameValue('');
    setLoading(true);
    const res = await fetch(`/api/pipelines/generic/${encodeURIComponent(taskType)}`);
    const data = await res.json();
    setGenPipelineConfig(data.stages ?? []);
    setLoading(false);
  }, []);

  const renameGenericPipeline = async () => {
    if (selection?.kind !== 'generic-config') return;
    const newName = genericRenameValue.trim();
    if (!newName || newName === selection.taskType) { setRenamingGeneric(false); return; }
    const oldName = selection.taskType;
    const res = await fetch(`/api/pipelines/generic/${encodeURIComponent(oldName)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`이름 변경 실패: ${err.error ?? res.status}`);
      return;
    }
    setRenamingGeneric(false);
    setGenericRenameValue('');
    await fetchAll();
    await selectGenericConfig(newName);
  };

  const toggleStage = (id: string, enabled: boolean) => {
    if (!config) return;
    setConfig({ ...config, stages: config.stages.map((s) => s.id === id ? { ...s, enabled } : s) });
  };

  const importStagesFromGeneric = async () => {
    if (!config?.genericPipeline) return;
    const res = await fetch(`/api/pipelines/generic/${encodeURIComponent(config.genericPipeline)}`);
    const data = await res.json();
    if (!data.stages?.length) return;
    const imported: StageConfig[] = (data.stages as GenStage[]).map((s) => ({ id: s.id, enabled: true }));
    setConfig({ ...config, stages: imported });
  };

  const save = async () => {
    if (!selection) return;
    setSaving(true);
    setSaveMsg('');

    if (selection.kind === 'project') {
      await fetch(
        `/api/pipelines/projects/${encodeURIComponent(selection.slug)}/${encodeURIComponent(selection.taskType)}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config, special }) },
      );
      await fetchAll();
    } else if (selection.kind === 'generic') {
      await fetch(
        `/api/pipelines/generic/${encodeURIComponent(selection.taskType)}/${encodeURIComponent(selection.stage)}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: genericContent }) },
      );
    } else if (selection.kind === 'generic-config') {
      await fetch(
        `/api/pipelines/generic/${encodeURIComponent(selection.taskType)}`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stages: genPipelineConfig }) },
      );
      // Refresh stage list in sidebar
      setGenericStages((prev) => ({ ...prev, [selection.taskType]: genPipelineConfig.map((s) => s.id) }));
      await fetchAll();
    }

    setSaving(false);
    setSaveMsg('저장됨');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const createProject = async () => {
    if (!newSlug.trim() || !newTaskType.trim()) return;
    setCreating(true);
    await fetch('/api/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: newSlug.trim(), taskType: newTaskType.trim() }),
    });
    await fetchAll();
    const s = newSlug.trim(), t = newTaskType.trim();
    setShowNewProject(false);
    setNewSlug('');
    setNewTaskType('');
    setCreating(false);
    selectProject(s, t);
  };

  const createGenericPipeline = async () => {
    if (!newGenericType.trim()) return;
    setCreatingGeneric(true);
    const taskType = newGenericType.trim();
    await fetch('/api/pipelines/generic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskType, stages: [] }),
    });
    await fetchAll();
    setShowNewGeneric(false);
    setNewGenericType('');
    setCreatingGeneric(false);
    selectGenericConfig(taskType);
  };

  const deleteGenericPipeline = async (taskType: string) => {
    if (!confirm(`"${taskType}" 범용 파이프라인을 삭제할까요?\n이 파이프라인을 참조하는 프로젝트 설정에서도 연결이 해제됩니다.`)) return;
    await fetch(`/api/pipelines/generic/${encodeURIComponent(taskType)}`, { method: 'DELETE' });
    if (selection?.kind === 'generic-config' && selection.taskType === taskType) setSelection(null);
    if (selection?.kind === 'generic' && selection.taskType === taskType) setSelection(null);
    setExpandedGeneric((prev) => { const n = { ...prev }; delete n[taskType]; return n; });
    setGenericStages((prev) => { const n = { ...prev }; delete n[taskType]; return n; });
    await fetchAll();
  };

  const isProjectSelected = (slug: string, taskType: string) =>
    selection?.kind === 'project' && selection.slug === slug && selection.taskType === taskType;

  const isGenericSelected = (taskType: string, stage: string) =>
    selection?.kind === 'generic' && selection.taskType === taskType && selection.stage === stage;

  const isGenericConfigSelected = (taskType: string) =>
    selection?.kind === 'generic-config' && selection.taskType === taskType;

  const projectsBySlug: Record<string, ProjectEntry[]> = {};
  for (const p of projects) {
    (projectsBySlug[p.slug] ??= []).push(p);
  }

  return (
    <div className="flex flex-col" style={{ height: '100vh', background: 'var(--bg-void)', overflow: 'hidden' }}>
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <div className="flex flex-col flex-shrink-0 overflow-y-auto" style={{ width: '260px', borderRight: '1px solid var(--border-dim)', background: 'var(--bg-base)' }}>

          {/* ── 프로젝트별 설정 ── */}
          <SectionHeader
            action={
              <button onClick={() => setShowNewProject((v) => !v)} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-green)', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '3px', padding: '2px 7px', cursor: 'pointer' }}>
                + 추가
              </button>
            }
          >
            프로젝트별 설정
          </SectionHeader>

          {showNewProject && (
            <div className="flex flex-col gap-2" style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-base)', borderRadius: '6px', padding: '10px', margin: '0 10px 6px' }}>
              <input placeholder="프로젝트 슬러그 (예: groupware)" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} style={{ ...monoInput, fontSize: '12px' }} />
              <input placeholder="업무유형 (예: 신규스펙개발)" value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} style={{ ...monoInput, fontSize: '12px' }} />
              <button onClick={createProject} disabled={creating || !newSlug || !newTaskType} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--bg-void)', background: 'var(--accent-green)', border: 'none', borderRadius: '4px', padding: '5px', opacity: creating ? 0.6 : 1, cursor: 'pointer' }}>
                {creating ? '생성 중...' : '생성'}
              </button>
            </div>
          )}

          <div style={{ padding: '0 8px 8px' }}>
            {Object.keys(projectsBySlug).length === 0 ? (
              <div style={{ padding: '6px 6px', opacity: 0.5 }}><MonoLabel dim>등록된 프로젝트 없음</MonoLabel></div>
            ) : (
              Object.entries(projectsBySlug).map(([slug, entries]) => (
                <div key={slug} style={{ marginBottom: '8px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-secondary)', padding: '3px 6px', borderLeft: '2px solid var(--border-base)', marginBottom: '3px', marginLeft: '4px' }}>
                    {slug}
                  </div>
                  <div className="flex flex-col gap-0.5" style={{ paddingLeft: '14px' }}>
                    {entries.map((p) => {
                      const active = isProjectSelected(p.slug, p.taskType);
                      return (
                        <button key={p.taskType} onClick={() => selectProject(p.slug, p.taskType)} style={{ textAlign: 'left', padding: '6px 8px', borderRadius: '4px', background: active ? 'rgba(0,230,118,0.08)' : 'transparent', border: `1px solid ${active ? 'rgba(0,230,118,0.25)' : 'transparent'}`, transition: 'all 0.1s', cursor: 'pointer' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? 'var(--accent-green)' : 'var(--text-primary)', marginBottom: '1px' }}>{p.taskType}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{p.enabledCount}/9 단계 활성</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ height: '1px', background: 'var(--border-dim)' }} />

          {/* ── 범용 파이프라인 ── */}
          <SectionHeader
            action={
              <button onClick={() => setShowNewGeneric((v) => !v)} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '3px', padding: '2px 7px', cursor: 'pointer' }}>
                + 추가
              </button>
            }
          >
            범용 파이프라인
          </SectionHeader>

          {showNewGeneric && (
            <div className="flex gap-2" style={{ margin: '0 10px 6px' }}>
              <input
                placeholder="이름 (예: 내부검토, 데이터분석)"
                value={newGenericType}
                onChange={(e) => setNewGenericType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createGenericPipeline()}
                style={{ ...monoInput, fontSize: '12px', flex: 1 }}
                autoFocus
              />
              <button
                onClick={createGenericPipeline}
                disabled={creatingGeneric || !newGenericType.trim()}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--bg-void)', background: 'var(--accent-cyan)', border: 'none', borderRadius: '4px', padding: '5px 10px', opacity: (creatingGeneric || !newGenericType.trim()) ? 0.4 : 1, cursor: 'pointer', flexShrink: 0 }}
              >
                {creatingGeneric ? '...' : '생성'}
              </button>
            </div>
          )}

          <div style={{ padding: '0 8px 16px' }}>
            {genericTaskTypes.length === 0 ? (
              <div style={{ padding: '6px 6px', opacity: 0.5 }}><MonoLabel dim>범용 파이프라인 없음</MonoLabel></div>
            ) : (
              genericTaskTypes.map((gt) => {
                const expanded = expandedGeneric[gt.taskType] ?? false;
                const stages = genericStages[gt.taskType] ?? [];
                const configActive = isGenericConfigSelected(gt.taskType);

                return (
                  <div key={gt.taskType} style={{ marginBottom: '4px' }}>
                    {/* Task type header */}
                    <div className="flex items-center" style={{ borderRadius: '4px', background: configActive ? 'rgba(0,229,255,0.06)' : 'transparent', border: `1px solid ${configActive ? 'rgba(0,229,255,0.2)' : 'transparent'}`, transition: 'all 0.1s' }}>
                      {/* Expand/collapse */}
                      <button
                        onClick={() => toggleGenericExpand(gt.taskType)}
                        style={{ flex: 1, textAlign: 'left', padding: '6px 8px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                      >
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', transition: 'transform 0.15s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none', lineHeight: 1, flexShrink: 0 }}>▶</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: configActive ? 'var(--accent-cyan)' : 'var(--text-primary)', flex: 1 }}>{gt.taskType}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{gt.stageCount}단계</span>
                      </button>
                      {/* Edit config button */}
                      <button
                        onClick={() => selectGenericConfig(gt.taskType)}
                        title="파이프라인 구성 편집"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: configActive ? 'var(--accent-cyan)' : 'var(--text-secondary)', background: 'transparent', border: 'none', padding: '4px 6px', cursor: 'pointer', flexShrink: 0 }}
                      >
                        편집
                      </button>
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
                          const active = isGenericSelected(gt.taskType, stage);
                          return (
                            <button
                              key={stage}
                              onClick={() => selectGenericStage(gt.taskType, stage)}
                              style={{ textAlign: 'left', padding: '5px 8px', borderRadius: '4px', background: active ? 'rgba(0,229,255,0.08)' : 'transparent', border: `1px solid ${active ? 'rgba(0,229,255,0.2)' : 'transparent'}`, transition: 'all 0.1s', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                            >
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)', letterSpacing: '0.04em', flex: 1 }}>{stage}</span>
                              {STAGE_LABELS[stage] && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{STAGE_LABELS[stage]}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Main Panel ── */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Toolbar: project */}
          {selection?.kind === 'project' && (
            <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{selection.slug}</span>
                <span style={{ color: 'var(--border-base)' }}>/</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-bright)' }}>{selection.taskType}</span>
                <div className="flex" style={{ background: 'var(--bg-void)', border: '1px solid var(--border-base)', borderRadius: '5px', overflow: 'hidden', marginLeft: '8px' }}>
                  {(['config', 'special'] as const).map((tab, i) => (
                    <button key={tab} onClick={() => setProjectTab(tab)} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: projectTab === tab ? 700 : 400, padding: '4px 12px', color: projectTab === tab ? 'var(--bg-void)' : 'var(--text-secondary)', background: projectTab === tab ? 'var(--accent-green)' : 'transparent', borderRight: i === 0 ? '1px solid var(--border-dim)' : 'none', cursor: 'pointer' }}>
                      {tab === 'config' ? '단계 설정' : '특수 규칙'}
                    </button>
                  ))}
                </div>
              </div>
              <SaveButton saving={saving} saveMsg={saveMsg} onSave={save} color="var(--accent-green)" />
            </div>
          )}

          {/* Toolbar: generic stage */}
          {selection?.kind === 'generic' && (
            <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '3px', padding: '2px 7px' }}>GENERIC</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{selection.taskType}</span>
                <span style={{ color: 'var(--border-base)' }}>/</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{selection.stage}.md</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>· 모든 프로젝트에서 공유</span>
              </div>
              <SaveButton saving={saving} saveMsg={saveMsg} onSave={save} color="var(--accent-cyan)" />
            </div>
          )}

          {/* Toolbar: generic pipeline config */}
          {selection?.kind === 'generic-config' && (
            <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)' }}>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '3px', padding: '2px 7px' }}>GENERIC</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{selection.taskType}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>· 파이프라인 구성</span>
              </div>
              <SaveButton saving={saving} saveMsg={saveMsg} onSave={save} color="var(--accent-cyan)" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-auto" style={{ padding: '24px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>로딩 중...</div>
            ) : !selection ? (
              <EmptyState />
            ) : selection.kind === 'project' && projectTab === 'config' && config ? (
              <div className="flex flex-col gap-3" style={{ maxWidth: '600px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  PIPELINE STAGES — 활성화된 단계만 오케스트레이터가 실행합니다
                </div>
                {/* Meta */}
                <div className="flex flex-col gap-2" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: '8px', padding: '14px', marginBottom: '4px' }}>
                  <div className="flex flex-col gap-1">
                    <MonoLabel dim>레이블</MonoLabel>
                    <input value={config.label} onChange={(e) => setConfig({ ...config, label: e.target.value })} style={monoInput} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <MonoLabel dim>설명</MonoLabel>
                    <input value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} style={monoInput} placeholder="파이프라인 설명 (선택)" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <MonoLabel dim>범용 파이프라인</MonoLabel>
                    <div className="flex gap-2 items-center">
                      <div style={{ flex: 1 }}>
                        <Select
                          value={config.genericPipeline ?? '__none__'}
                          onChange={(v) => setConfig({ ...config, genericPipeline: v === '__none__' ? undefined : v })}
                          placeholder="선택 안 함"
                          options={[
                            { value: '__none__', label: '선택 안 함' },
                            ...genericTaskTypes.map((gt) => ({ value: gt.taskType, label: gt.taskType })),
                          ]}
                        />
                      </div>
                      {config.genericPipeline && (
                        <button
                          onClick={importStagesFromGeneric}
                          title="pipeline.json에서 스테이지 가져오기"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: '3px', padding: '4px 8px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                        >
                          ↓ 스테이지 가져오기
                        </button>
                      )}
                    </div>
                    {config.genericPipeline && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                        .claude/commands/generic/<span style={{ color: 'var(--accent-cyan)' }}>{config.genericPipeline}</span>/
                      </span>
                    )}
                  </div>
                </div>
                {(config.stages ?? ORDERED_STAGES.map((id) => ({ id, enabled: true }))).map((stage) => (
                  <StageToggle key={stage.id} stage={stage.id} enabled={stage.enabled} onChange={(enabled) => toggleStage(stage.id, enabled)} />
                ))}
              </div>
            ) : selection.kind === 'project' && projectTab === 'special' ? (
              <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 160px)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  SPECIAL RULES — ## SECTION 헤더로 구분된 프로젝트+업무유형별 추가 컨텍스트 및 규칙
                </div>
                <textarea value={special} onChange={(e) => setSpecial(e.target.value)} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.6', background: 'var(--bg-raised)', border: '1px solid var(--border-base)', borderRadius: '6px', color: 'var(--text-primary)', padding: '16px', resize: 'none', outline: 'none', whiteSpace: 'pre' }} />
              </div>
            ) : selection.kind === 'generic' ? (
              <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 160px)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                  .claude/commands/generic/{selection.taskType}/{selection.stage}.md
                </div>
                <textarea value={genericContent} onChange={(e) => setGenericContent(e.target.value)} style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.6', background: 'var(--bg-raised)', border: '1px solid var(--border-base)', borderRadius: '6px', color: 'var(--text-primary)', padding: '16px', resize: 'none', outline: 'none', whiteSpace: 'pre' }} />
              </div>
            ) : selection.kind === 'generic-config' ? (
              <div className="flex flex-col gap-4" style={{ maxWidth: '640px' }}>
                {/* 이름 수정 */}
                <div className="flex items-center gap-2">
                  {renamingGeneric ? (
                    <>
                      <input
                        value={genericRenameValue}
                        onChange={(e) => setGenericRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameGenericPipeline(); if (e.key === 'Escape') setRenamingGeneric(false); }}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-bright)', background: 'var(--bg-surface)', border: '1px solid var(--accent-cyan)', borderRadius: '5px', padding: '4px 10px', flex: 1, outline: 'none' }}
                        autoFocus
                      />
                      <button onClick={renameGenericPipeline} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--bg-void)', background: 'var(--accent-cyan)', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}>저장</button>
                      <button onClick={() => setRenamingGeneric(false)} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '4px', padding: '5px 8px', cursor: 'pointer' }}>ESC</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-bright)' }}>{selection.taskType}</span>
                      <button onClick={() => { setGenericRenameValue(selection.taskType); setRenamingGeneric(true); }} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}>이름 수정</button>
                    </>
                  )}
                </div>

                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    PIPELINE.JSON — 스테이지 순서, 병렬 그룹 설정
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.6' }}>
                    스테이지를 추가·삭제·순서 변경할 수 있습니다.<br />
                    같은 <span style={{ color: 'var(--accent-cyan)' }}>병렬그룹</span> 이름을 가진 연속 스테이지들은 독립 에이전트로 동시 실행됩니다.
                  </div>
                  <GenStageEditor stages={genPipelineConfig} onChange={setGenPipelineConfig} />
                </div>

                {genPipelineConfig.length > 0 && (
                  <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: '8px', padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '10px' }}>EXECUTION PLAN PREVIEW</div>
                    <ExecutionPlanPreview stages={genPipelineConfig} />
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Execution Plan Preview ───────────────────────────────────────────

function ExecutionPlanPreview({ stages }: { stages: GenStage[] }) {
  // Build batches
  const batches: GenStage[][] = [];
  let i = 0;
  while (i < stages.length) {
    const s = stages[i];
    if (s.parallelGroup) {
      const batch = [s];
      let j = i + 1;
      while (j < stages.length && stages[j].parallelGroup === s.parallelGroup) {
        batch.push(stages[j]);
        j++;
      }
      batches.push(batch);
      i = j;
    } else {
      batches.push([s]);
      i++;
    }
  }

  return (
    <div className="flex items-start gap-2" style={{ flexWrap: 'wrap' }}>
      {batches.map((batch, bi) => {
        const isParallel = batch.length > 1;
        const gc = isParallel && batch[0].parallelGroup ? parallelGroupColor(batch[0].parallelGroup) : null;
        return (
          <div key={bi} className="flex items-center gap-2">
            <div style={{ background: isParallel ? `${gc}15` : 'var(--bg-overlay)', border: `1px solid ${isParallel ? `${gc}50` : 'var(--border-base)'}`, borderRadius: '6px', padding: '6px 10px' }}>
              {isParallel && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: gc ?? 'var(--text-muted)', marginBottom: '4px', letterSpacing: '0.08em' }}>
                  ⟺ 병렬
                </div>
              )}
              {batch.map((s, si) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: si > 0 ? '3px' : 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: gc ?? 'var(--accent-cyan)' }}>{s.id}</span>
                  {s.label && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>· {s.label}</span>}
                </div>
              ))}
            </div>
            {bi < batches.length - 1 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--border-base)' }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
