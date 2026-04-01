'use client';

import { useState, useEffect } from 'react';
import { Select } from '@/components/ui/Select';

interface Project {
  id: string;
  name: string;
  repo_url?: string;
}

interface PipelineConfig {
  slug: string;
  taskType: string;
  label: string;
}

interface SessionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}

function FormLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label
      style={{
        display: 'block',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
        marginBottom: '6px',
      }}
    >
      {children}
      {optional && (
        <span style={{ color: 'var(--text-ghost)', fontWeight: 400, marginLeft: '6px' }}>
          선택
        </span>
      )}
    </label>
  );
}

export function SessionForm({ isOpen, onClose, onCreated }: SessionFormProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelineConfigs, setPipelineConfigs] = useState<PipelineConfig[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState(''); // "slug/taskType"
  const [branchName, setBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [gitlabBranches, setGitlabBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [apiMode, setApiMode] = useState<'h-chat' | 'claude-max' | 'anthropic'>('claude-max');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setProjects(d))
      .catch(() => {});
    fetch('/api/pipelines')
      .then((r) => r.json())
      .then((d) => {
        const configs = (d.projects ?? []) as Array<{ slug: string; taskType: string; label: string }>;
        setPipelineConfigs(configs);
      })
      .catch(() => {});
  }, [isOpen]);

  // Load GitLab branches when project changes
  useEffect(() => {
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project?.repo_url) {
      setGitlabBranches([]);
      return;
    }
    const gitlabId = project.repo_url.replace(/^https?:\/\/[^/]+\//, '');
    setBranchesLoading(true);
    fetch(`/api/gitlab/branches?projectId=${encodeURIComponent(gitlabId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setGitlabBranches(d.map((b: { name: string }) => b.name));
      })
      .catch(() => {})
      .finally(() => setBranchesLoading(false));
  }, [selectedProjectId, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !branchName || !notes) return;
    setSubmitting(true);

    const [pipelineSlug, pipelineTaskType] = selectedPipeline.split('/');
    const sessionName = branchName || notes.slice(0, 40);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName,
          project_id: selectedProjectId,
          form_data: {
            project_slug: pipelineSlug || undefined,
            task_type: pipelineTaskType || undefined,
            branch_name: branchName,
            base_branch: baseBranch || undefined,
            notes,
            api_mode: apiMode,
          },
        }),
      });
      if (res.ok) {
        const session = await res.json();
        onCreated(session.id);
        onClose();
        // Reset
        setSelectedProjectId('');
        setSelectedPipeline('');
        setBranchName('');
        setBaseBranch('');
        setNotes('');
        setApiMode('claude-max');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canSubmit = selectedProjectId && branchName.trim() && notes.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-base)',
          borderRadius: '10px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-dim)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--accent-green)',
                boxShadow: '0 0 8px var(--accent-green)',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-bright)',
                letterSpacing: '0.06em',
              }}
            >
              NEW SESSION
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-ghost)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5" style={{ padding: '20px' }}>

            {/* Project + Pipeline - side by side */}
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <FormLabel>프로젝트</FormLabel>
                <Select
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  placeholder="선택"
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FormLabel>파이프라인</FormLabel>
                <Select
                  value={selectedPipeline}
                  onChange={setSelectedPipeline}
                  placeholder="선택"
                  options={pipelineConfigs.map((c) => ({
                    value: `${c.slug}/${c.taskType}`,
                    label: `${c.slug} / ${c.taskType}`,
                  }))}
                />
              </div>
            </div>

            {/* Branch name */}
            <div>
              <FormLabel>브랜치명</FormLabel>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="feature/my-button"
                required
                className="input-field input-mono w-full"
              />
            </div>

            {/* Base branch */}
            <div>
              <FormLabel optional>베이스 브랜치</FormLabel>
              {gitlabBranches.length > 0 ? (
                <Select
                  value={baseBranch}
                  onChange={setBaseBranch}
                  placeholder={branchesLoading ? '로딩 중...' : 'main'}
                  options={gitlabBranches.map((b) => ({ value: b, label: b }))}
                />
              ) : (
                <input
                  type="text"
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  placeholder={branchesLoading ? '로딩 중...' : 'main'}
                  className="input-field input-mono w-full"
                />
              )}
              {!projects.find((p) => p.id === selectedProjectId)?.repo_url && selectedProjectId && (
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--text-ghost)',
                    marginTop: '4px',
                  }}
                >
                  GitLab repo_url 미설정 — 직접 입력하세요
                </p>
              )}
            </div>

            {/* Work description */}
            <div>
              <FormLabel>작업 내용</FormLabel>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="메인 페이지 우측 상단에 파란색 저장 버튼을 추가해주세요"
                required
                rows={4}
                className="input-field w-full"
                style={{ resize: 'vertical', lineHeight: '1.6' }}
              />
            </div>

            {/* API Mode */}
            <div>
              <FormLabel>API 모드</FormLabel>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'claude-max', label: 'CLAUDE MAX' },
                    { value: 'h-chat', label: 'H-CHAT' },
                    { value: 'anthropic', label: 'ANTHROPIC' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setApiMode(opt.value)}
                    style={{
                      flex: 1,
                      padding: '7px 8px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      borderRadius: '5px',
                      border: apiMode === opt.value
                        ? '1px solid var(--accent-green)'
                        : '1px solid var(--border-base)',
                      background: apiMode === opt.value
                        ? 'rgba(0,230,118,0.08)'
                        : 'var(--bg-surface)',
                      color: apiMode === opt.value
                        ? 'var(--accent-green)'
                        : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {apiMode === 'h-chat' ? (
                <div
                  style={{
                    marginTop: '6px',
                    padding: '7px 10px',
                    borderRadius: '5px',
                    background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.3)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                  }}
                >
                  <span style={{ fontSize: '11px', flexShrink: 0 }}>⚠️</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--accent-amber, #f59e0b)',
                      lineHeight: '1.5',
                    }}
                  >
                    H-Chat은 회사 내부 네트워크 전용입니다.{' '}
                    <strong>VPN을 켠 상태</strong>에서 실행해주세요.
                  </span>
                </div>
              ) : (
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--text-ghost)',
                    marginTop: '5px',
                  }}
                >
                  {apiMode === 'claude-max' && '로컬 ~/.claude/ OAuth 세션 사용 (Claude.ai Pro/Max)'}
                  {apiMode === 'anthropic' && 'Anthropic API 키 사용 (유료 과금)'}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex gap-3"
            style={{ padding: '14px 20px', borderTop: '1px solid var(--border-dim)' }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                padding: '8px 16px',
              }}
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={submitting || !canSubmit}
              style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '10px',
                borderRadius: '6px',
                background: canSubmit ? 'var(--accent-green)' : 'var(--border-base)',
                color: canSubmit ? 'var(--bg-void)' : 'var(--text-ghost)',
                border: 'none',
                transition: 'all 0.15s',
                boxShadow: canSubmit ? '0 0 16px rgba(0,230,118,0.2)' : 'none',
              }}
            >
              {submitting ? 'CREATING...' : 'CREATE SESSION'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
