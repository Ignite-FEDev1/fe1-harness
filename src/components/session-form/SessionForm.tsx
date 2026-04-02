'use client';

import { useState, useEffect, useRef } from 'react';
import { Select } from '@/components/ui/Select';
import { useUser } from '@/contexts/UserContext';

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

interface GenericTaskType {
  taskType: string;
  stageCount: number;
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
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
        marginBottom: '6px',
      }}
    >
      {children}
      {optional && (
        <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
          선택
        </span>
      )}
    </label>
  );
}

export function SessionForm({ isOpen, onClose, onCreated }: SessionFormProps) {
  const { selectedUser, currentModel } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelineConfigs, setPipelineConfigs] = useState<PipelineConfig[]>([]);
  const [genericTaskTypes, setGenericTaskTypes] = useState<GenericTaskType[]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedGeneric, setSelectedGeneric] = useState('');
  const [selectedSpecialRules, setSelectedSpecialRules] = useState(''); // "slug/taskType"

  const [sessionName, setSessionName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [gitlabBranches, setGitlabBranches] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiMode, setApiMode] = useState<'h-chat' | 'claude-max' | 'anthropic'>('claude-max');
  const [submitting, setSubmitting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setNotes(text);
      setUploadedFileName(file.name);
    };
    reader.readAsText(file, 'utf-8');
    // Reset input so the same file can be re-uploaded
    e.target.value = '';
  };

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setProjects(d))
      .catch(() => {});
    fetch('/api/pipelines')
      .then((r) => r.json())
      .then((d) => {
        setPipelineConfigs((d.projects ?? []) as PipelineConfig[]);
        setGenericTaskTypes((d.genericTaskTypes ?? []) as GenericTaskType[]);
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
    if (!notes) return;
    setSubmitting(true);

    const [specialSlug, specialTaskType] = selectedSpecialRules.split('/');
    const resolvedName = sessionName.trim() || branchName.trim() || notes.slice(0, 40);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: resolvedName,
          project_id: selectedProjectId || undefined,
          form_data: {
            generic_pipeline: selectedGeneric || undefined,
            project_slug: specialSlug || undefined,
            task_type: specialTaskType || undefined,
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
        // Auto-run immediately after creation
        fetch(`/api/sessions/${session.id}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedUser?.id ?? null,
            apiMode,
            model: currentModel,
          }),
        }).catch(() => {});
        // Reset
        setSelectedProjectId('');
        setSelectedGeneric('');
        setSelectedSpecialRules('');
        setSessionName('');
        setBranchName('');
        setBaseBranch('');
        setNotes('');
        setUploadedFileName('');
        setApiMode('claude-max');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canSubmit = notes.trim();

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
              color: 'var(--text-muted)',
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

            {/* 1. 프로젝트 선택 */}
            <div>
              <FormLabel optional>프로젝트</FormLabel>
              <Select
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                placeholder="선택 (코드 작업이 없으면 생략 가능)"
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
              />
              {!projects.find((p) => p.id === selectedProjectId)?.repo_url && selectedProjectId && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  GitLab repo_url 미설정
                </p>
              )}
            </div>

            {/* 2. 범용 파이프라인 + 3. 프로젝트 특수 규칙 — side by side */}
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <FormLabel optional>범용 파이프라인</FormLabel>
                <Select
                  value={selectedGeneric}
                  onChange={setSelectedGeneric}
                  placeholder="선택"
                  options={genericTaskTypes.map((g) => ({
                    value: g.taskType,
                    label: `${g.taskType} (${g.stageCount}단계)`,
                  }))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FormLabel optional>프로젝트 특수 규칙</FormLabel>
                <Select
                  value={selectedSpecialRules}
                  onChange={setSelectedSpecialRules}
                  placeholder="선택"
                  options={pipelineConfigs.map((c) => ({
                    value: `${c.slug}/${c.taskType}`,
                    label: `${c.slug} / ${c.label}`,
                  }))}
                />
              </div>
            </div>

            {/* 세션명 */}
            <div>
              <FormLabel optional>세션명</FormLabel>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="미입력 시 브랜치명 또는 작업 내용 앞부분으로 자동 설정"
                className="input-field w-full"
              />
            </div>

            {/* 브랜치명 */}
            <div>
              <FormLabel optional>브랜치명</FormLabel>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="feature/my-button"
                className="input-field input-mono w-full"
              />
            </div>

            {/* 베이스 브랜치 */}
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
            </div>

            {/* 작업 내용 */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                <FormLabel>작업 내용</FormLabel>
                <div className="flex items-center gap-2">
                  {uploadedFileName && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-green)' }}>
                      {uploadedFileName}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-base)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    .md 업로드
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.txt"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setUploadedFileName(''); }}
                placeholder="메인 페이지 우측 상단에 파란색 저장 버튼을 추가해주세요"
                rows={4}
                className="input-field w-full"
                style={{ resize: 'vertical', lineHeight: '1.6' }}
              />
            </div>

            {/* API 모드 */}
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
                      fontSize: '12px',
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
                  <span style={{ fontSize: '12px', flexShrink: 0 }}>⚠️</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'var(--accent-amber, #f59e0b)',
                      lineHeight: '1.5',
                    }}
                  >
                    H-Chat은 회사 내부 네트워크 전용입니다.{' '}
                    <strong>VPN을 켠 상태</strong>에서 실행해주세요.
                  </span>
                </div>
              ) : (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '5px' }}>
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
                fontSize: '12px',
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
                color: canSubmit ? 'var(--bg-void)' : 'var(--text-muted)',
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
