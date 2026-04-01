'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';

const ORDERED_STAGES = [
  'plan', 'plan-review', 'ticket', 'ticket-review',
  'develop', 'develop-review', 'pr', 'qa', 'qa-review',
] as const;

type StageId = (typeof ORDERED_STAGES)[number] | string;

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

// What's currently displayed in the main panel
type Selection =
  | { kind: 'project'; slug: string; taskType: string }
  | { kind: 'generic'; taskType: string; stage: string };

function MonoLabel({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        letterSpacing: '0.08em',
        color: dim ? 'var(--text-ghost)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </span>
  );
}

function SectionHeader({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: '12px 14px 6px', gap: '8px' }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--text-ghost)',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </span>
      {action}
    </div>
  );
}

function StageToggle({
  stage,
  enabled,
  onChange,
}: {
  stage: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const label = STAGE_LABELS[stage] ?? stage;
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: '10px 14px',
        background: enabled ? 'rgba(0,230,118,0.04)' : 'var(--bg-raised)',
        border: `1px solid ${enabled ? 'rgba(0,230,118,0.2)' : 'var(--border-dim)'}`,
        borderRadius: '6px',
        transition: 'all 0.15s',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: enabled ? 'var(--accent-green)' : 'var(--border-base)',
            boxShadow: enabled ? '0 0 6px var(--accent-green)' : 'none',
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 600,
              color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
              letterSpacing: '0.04em',
            }}
          >
            {stage}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: 'var(--text-ghost)',
              marginTop: '1px',
            }}
          >
            {label}
          </div>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={onChange} />
    </div>
  );
}

const monoInput = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  background: 'var(--bg-void)',
  border: '1px solid var(--border-base)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
} as const;

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
  const [creatingGeneric, setCreatingGeneric] = useState(false);

  const fetchAll = useCallback(async () => {
    const res = await fetch('/api/pipelines');
    const data = await res.json();
    setProjects(data.projects ?? []);
    setGenericTaskTypes(data.genericTaskTypes ?? []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Load stages for a generic task type when expanded
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
    const res = await fetch(
      `/api/pipelines/projects/${encodeURIComponent(slug)}/${encodeURIComponent(taskType)}`,
    );
    const data = await res.json();
    setConfig(data.config);
    setSpecial(data.special);
    setLoading(false);
  }, []);

  const selectGenericStage = useCallback(async (taskType: string, stage: string) => {
    setSelection({ kind: 'generic', taskType, stage });
    setLoading(true);
    const res = await fetch(
      `/api/pipelines/generic/${encodeURIComponent(taskType)}/${encodeURIComponent(stage)}`,
    );
    const data = await res.json();
    setGenericContent(data.content ?? '');
    setLoading(false);
  }, []);

  const toggleStage = (id: string, enabled: boolean) => {
    if (!config) return;
    setConfig({
      ...config,
      stages: config.stages.map((s) => s.id === id ? { ...s, enabled } : s),
    });
  };

  const save = async () => {
    if (!selection) return;
    setSaving(true);
    setSaveMsg('');

    if (selection.kind === 'project') {
      await fetch(
        `/api/pipelines/projects/${encodeURIComponent(selection.slug)}/${encodeURIComponent(selection.taskType)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config, special }),
        },
      );
      await fetchAll();
    } else {
      await fetch(
        `/api/pipelines/generic/${encodeURIComponent(selection.taskType)}/${encodeURIComponent(selection.stage)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: genericContent }),
        },
      );
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
    const s = newSlug.trim();
    const t = newTaskType.trim();
    setShowNewProject(false);
    setNewSlug('');
    setNewTaskType('');
    setCreating(false);
    selectProject(s, t);
  };

  const createGenericPipeline = async () => {
    if (!newGenericType.trim()) return;
    setCreatingGeneric(true);
    await fetch('/api/pipelines/generic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskType: newGenericType.trim() }),
    });
    await fetchAll();
    setShowNewGeneric(false);
    setNewGenericType('');
    setCreatingGeneric(false);
    setExpandedGeneric((prev) => ({ ...prev, [newGenericType.trim()]: true }));
  };

  const isProjectSelected = (slug: string, taskType: string) =>
    selection?.kind === 'project' && selection.slug === slug && selection.taskType === taskType;

  const isGenericSelected = (taskType: string, stage: string) =>
    selection?.kind === 'generic' && selection.taskType === taskType && selection.stage === stage;

  // Group projects by slug
  const projectsBySlug: Record<string, ProjectEntry[]> = {};
  for (const p of projects) {
    (projectsBySlug[p.slug] ??= []).push(p);
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: 'var(--bg-void)', overflow: 'hidden' }}
    >
      <AppHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <div
          className="flex flex-col flex-shrink-0 overflow-y-auto"
          style={{
            width: '248px',
            borderRight: '1px solid var(--border-dim)',
            background: 'var(--bg-base)',
          }}
        >
          {/* ── Section: 프로젝트별 설정 ── */}
          <SectionHeader
            action={
              <button
                onClick={() => setShowNewProject((v) => !v)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--accent-green)',
                  background: 'rgba(0,230,118,0.08)',
                  border: '1px solid rgba(0,230,118,0.2)',
                  borderRadius: '3px',
                  padding: '2px 7px',
                }}
              >
                + 추가
              </button>
            }
          >
            프로젝트별 설정
          </SectionHeader>

          {showNewProject && (
            <div
              className="flex flex-col gap-2"
              style={{
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-base)',
                borderRadius: '6px',
                padding: '10px',
                margin: '0 10px 6px',
              }}
            >
              <input
                placeholder="프로젝트 슬러그 (예: groupware)"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                style={{ ...monoInput, fontSize: '10px' }}
              />
              <input
                placeholder="업무유형 (예: 신규스펙개발)"
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value)}
                style={{ ...monoInput, fontSize: '10px' }}
              />
              <button
                onClick={createProject}
                disabled={creating || !newSlug || !newTaskType}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--bg-void)',
                  background: 'var(--accent-green)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px',
                  opacity: creating ? 0.6 : 1,
                }}
              >
                {creating ? '생성 중...' : '생성'}
              </button>
            </div>
          )}

          <div style={{ padding: '0 8px 8px' }}>
            {Object.keys(projectsBySlug).length === 0 ? (
              <div style={{ padding: '6px 6px', opacity: 0.5 }}>
                <MonoLabel dim>등록된 프로젝트 없음</MonoLabel>
              </div>
            ) : (
              Object.entries(projectsBySlug).map(([slug, entries]) => (
                <div key={slug} style={{ marginBottom: '8px' }}>
                  {/* Slug header */}
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: 'var(--text-secondary)',
                      padding: '3px 6px',
                      borderLeft: '2px solid var(--border-base)',
                      marginBottom: '3px',
                      marginLeft: '4px',
                    }}
                  >
                    {slug}
                  </div>
                  {/* Task types */}
                  <div className="flex flex-col gap-0.5" style={{ paddingLeft: '14px' }}>
                    {entries.map((p) => {
                      const active = isProjectSelected(p.slug, p.taskType);
                      return (
                        <button
                          key={p.taskType}
                          onClick={() => selectProject(p.slug, p.taskType)}
                          style={{
                            textAlign: 'left',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: active ? 'rgba(0,230,118,0.08)' : 'transparent',
                            border: `1px solid ${active ? 'rgba(0,230,118,0.25)' : 'transparent'}`,
                            transition: 'all 0.1s',
                          }}
                        >
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '11px',
                              fontWeight: active ? 600 : 400,
                              color: active ? 'var(--accent-green)' : 'var(--text-primary)',
                              marginBottom: '1px',
                            }}
                          >
                            {p.taskType}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '9px',
                              color: 'var(--text-ghost)',
                            }}
                          >
                            {p.enabledCount}/9 단계 활성
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Divider ── */}
          <div style={{ height: '1px', background: 'var(--border-dim)' }} />

          {/* ── Section: 범용 파이프라인 ── */}
          <SectionHeader
            action={
              <button
                onClick={() => setShowNewGeneric((v) => !v)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--accent-cyan)',
                  background: 'rgba(0,229,255,0.08)',
                  border: '1px solid rgba(0,229,255,0.2)',
                  borderRadius: '3px',
                  padding: '2px 7px',
                }}
              >
                + 추가
              </button>
            }
          >
            범용 파이프라인
          </SectionHeader>

          {showNewGeneric && (
            <div
              className="flex flex-col gap-2"
              style={{
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-base)',
                borderRadius: '6px',
                padding: '10px',
                margin: '0 10px 6px',
              }}
            >
              <input
                placeholder="업무유형 (예: 신규스펙개발)"
                value={newGenericType}
                onChange={(e) => setNewGenericType(e.target.value)}
                style={{ ...monoInput, fontSize: '10px' }}
              />
              <button
                onClick={createGenericPipeline}
                disabled={creatingGeneric || !newGenericType}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--bg-void)',
                  background: 'var(--accent-cyan)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px',
                  opacity: creatingGeneric ? 0.6 : 1,
                }}
              >
                {creatingGeneric ? '생성 중...' : '생성'}
              </button>
            </div>
          )}

          <div style={{ padding: '0 8px 16px' }}>
            {genericTaskTypes.length === 0 ? (
              <div style={{ padding: '6px 6px', opacity: 0.5 }}>
                <MonoLabel dim>범용 파이프라인 없음</MonoLabel>
              </div>
            ) : (
              genericTaskTypes.map((gt) => {
                const expanded = expandedGeneric[gt.taskType] ?? false;
                const stages = genericStages[gt.taskType] ?? [];

                return (
                  <div key={gt.taskType} style={{ marginBottom: '4px' }}>
                    {/* Task type header — expand/collapse */}
                    <button
                      onClick={() => toggleGenericExpand(gt.taskType)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        background: 'transparent',
                        border: '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'background 0.1s',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9px',
                          color: 'var(--text-ghost)',
                          transition: 'transform 0.15s',
                          display: 'inline-block',
                          transform: expanded ? 'rotate(90deg)' : 'none',
                          lineHeight: 1,
                        }}
                      >
                        ▶
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          flex: 1,
                        }}
                      >
                        {gt.taskType}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '9px',
                          color: 'var(--text-ghost)',
                        }}
                      >
                        {gt.stageCount}단계
                      </span>
                    </button>

                    {/* Stage list when expanded */}
                    {expanded && (
                      <div
                        className="flex flex-col gap-0.5"
                        style={{ paddingLeft: '20px', paddingBottom: '4px' }}
                      >
                        {stages.map((stage) => {
                          const active = isGenericSelected(gt.taskType, stage);
                          return (
                            <button
                              key={stage}
                              onClick={() => selectGenericStage(gt.taskType, stage)}
                              style={{
                                textAlign: 'left',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                background: active ? 'rgba(0,229,255,0.08)' : 'transparent',
                                border: `1px solid ${active ? 'rgba(0,229,255,0.2)' : 'transparent'}`,
                                transition: 'all 0.1s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '10px',
                                  color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                  letterSpacing: '0.04em',
                                  flex: 1,
                                }}
                              >
                                {stage}
                              </span>
                              {STAGE_LABELS[stage] && (
                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '9px',
                                    color: 'var(--text-ghost)',
                                  }}
                                >
                                  {STAGE_LABELS[stage]}
                                </span>
                              )}
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

          {/* Toolbar: project mode */}
          {selection?.kind === 'project' && (
            <div
              className="flex items-center justify-between flex-shrink-0"
              style={{
                padding: '10px 20px',
                borderBottom: '1px solid var(--border-dim)',
                background: 'var(--bg-base)',
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-ghost)' }}>
                  {selection.slug}
                </span>
                <span style={{ color: 'var(--border-base)' }}>/</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--text-bright)' }}>
                  {selection.taskType}
                </span>
                <div
                  className="flex"
                  style={{
                    background: 'var(--bg-void)',
                    border: '1px solid var(--border-base)',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    marginLeft: '8px',
                  }}
                >
                  {(['config', 'special'] as const).map((tab, i) => (
                    <button
                      key={tab}
                      onClick={() => setProjectTab(tab)}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: projectTab === tab ? 700 : 400,
                        padding: '4px 12px',
                        color: projectTab === tab ? 'var(--bg-void)' : 'var(--text-secondary)',
                        background: projectTab === tab ? 'var(--accent-green)' : 'transparent',
                        borderRight: i === 0 ? '1px solid var(--border-dim)' : 'none',
                      }}
                    >
                      {tab === 'config' ? '단계 설정' : '특수 규칙'}
                    </button>
                  ))}
                </div>
              </div>
              <SaveButton saving={saving} saveMsg={saveMsg} onSave={save} color="var(--accent-green)" />
            </div>
          )}

          {/* Toolbar: generic stage mode */}
          {selection?.kind === 'generic' && (
            <div
              className="flex items-center justify-between flex-shrink-0"
              style={{
                padding: '10px 20px',
                borderBottom: '1px solid var(--border-dim)',
                background: 'var(--bg-base)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: 'var(--text-ghost)',
                    background: 'rgba(0,229,255,0.08)',
                    border: '1px solid rgba(0,229,255,0.2)',
                    borderRadius: '3px',
                    padding: '2px 7px',
                  }}
                >
                  GENERIC
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-ghost)' }}>
                  {selection.taskType}
                </span>
                <span style={{ color: 'var(--border-base)' }}>/</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--accent-cyan)',
                  }}
                >
                  {selection.stage}.md
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-ghost)' }}>
                  · 모든 프로젝트에서 공유
                </span>
              </div>
              <SaveButton saving={saving} saveMsg={saveMsg} onSave={save} color="var(--accent-cyan)" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-auto" style={{ padding: '24px' }}>
            {loading ? (
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '200px', fontFamily: 'var(--font-mono)', fontSize: '12px',
                  color: 'var(--text-ghost)',
                }}
              >
                로딩 중...
              </div>
            ) : !selection ? (
              <EmptyState />
            ) : selection.kind === 'project' && projectTab === 'config' && config ? (
              <div className="flex flex-col gap-3" style={{ maxWidth: '600px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-ghost)', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  PIPELINE STAGES — 활성화된 단계만 오케스트레이터가 실행합니다
                </div>
                {/* Meta */}
                <div
                  className="flex flex-col gap-2"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: '8px', padding: '14px', marginBottom: '4px' }}
                >
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
                    <Select
                      value={config.genericPipeline ?? '__none__'}
                      onChange={(v) => setConfig({ ...config, genericPipeline: v === '__none__' ? undefined : v })}
                      placeholder="선택 안 함"
                      options={[
                        { value: '__none__', label: '선택 안 함' },
                        ...genericTaskTypes.map((gt) => ({ value: gt.taskType, label: gt.taskType })),
                      ]}
                    />
                    {config.genericPipeline && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-ghost)' }}>
                        .claude/commands/generic/<span style={{ color: 'var(--accent-cyan)' }}>{config.genericPipeline}</span>/
                      </span>
                    )}
                  </div>
                </div>
                {(config.stages ?? ORDERED_STAGES.map((id) => ({ id, enabled: true }))).map((stage) => (
                  <StageToggle
                    key={stage.id}
                    stage={stage.id}
                    enabled={stage.enabled}
                    onChange={(enabled) => toggleStage(stage.id, enabled)}
                  />
                ))}
              </div>
            ) : selection.kind === 'project' && projectTab === 'special' ? (
              <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 160px)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-ghost)', letterSpacing: '0.08em' }}>
                  SPECIAL RULES — ## SECTION 헤더로 구분된 프로젝트+업무유형별 추가 컨텍스트 및 규칙
                </div>
                <textarea
                  value={special}
                  onChange={(e) => setSpecial(e.target.value)}
                  style={{
                    flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.6',
                    background: 'var(--bg-raised)', border: '1px solid var(--border-base)', borderRadius: '6px',
                    color: 'var(--text-primary)', padding: '16px', resize: 'none', outline: 'none', whiteSpace: 'pre',
                  }}
                />
              </div>
            ) : selection.kind === 'generic' ? (
              <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 160px)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-ghost)', letterSpacing: '0.08em' }}>
                  .claude/commands/generic/{selection.taskType}/{selection.stage}.md
                </div>
                <textarea
                  value={genericContent}
                  onChange={(e) => setGenericContent(e.target.value)}
                  style={{
                    flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.6',
                    background: 'var(--bg-raised)', border: '1px solid var(--border-base)', borderRadius: '6px',
                    color: 'var(--text-primary)', padding: '16px', resize: 'none', outline: 'none', whiteSpace: 'pre',
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveButton({
  saving, saveMsg, onSave, color,
}: {
  saving: boolean; saveMsg: string; onSave: () => void; color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {saveMsg && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent-green)' }}>
          {saveMsg}
        </span>
      )}
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.06em', padding: '6px 16px', borderRadius: '4px',
          background: color, color: 'var(--bg-void)', border: 'none',
          opacity: saving ? 0.6 : 1,
        }}
      >
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
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-ghost)' }}>
        왼쪽에서 프로젝트 설정 또는 범용 파이프라인 스테이지를 선택하세요
      </p>
    </div>
  );
}
