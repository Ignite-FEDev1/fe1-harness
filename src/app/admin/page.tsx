'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, type TokenInfo } from '@/contexts/UserContext';
import { AppHeader } from '@/components/layout/AppHeader';

interface Project {
  id: string;
  name: string;
  repo_url?: string;
  description?: string;
}

interface UserProjectPath {
  project_id: string;
  local_path: string;
  projects?: { id: string; name: string };
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xs font-semibold tracking-widest mb-4 pb-2"
      style={{
        color: 'var(--text-ghost)',
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        borderBottom: '1px solid var(--border-dim)',
      }}
    >
      {children}
    </h2>
  );
}

// --- Token Row (editable) ---
function TokenRow({
  tokenKey,
  info,
  userId,
  onSaved,
}: {
  tokenKey: string;
  info: TokenInfo;
  userId: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setValue(info.value);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, key: tokenKey, value }),
      });
      if (res.ok) {
        setEditing(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setValue('');
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-dim)' }}
    >
      {/* Key & Label */}
      <div className="w-56 flex-shrink-0">
        <div
          className="text-xs"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}
        >
          {tokenKey}
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-ghost)', fontSize: '10px' }}>
          {info.label}
        </div>
      </div>

      {/* Value / Edit */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex gap-2">
            <input
              type={info.sensitive ? 'password' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input-field input-mono flex-1"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 text-xs font-semibold rounded disabled:opacity-30"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                background: 'var(--accent-green)',
                color: 'var(--bg-void)',
              }}
            >
              {saving ? '...' : 'SAVE'}
            </button>
            <button
              onClick={handleCancel}
              className="px-2 py-1 text-xs rounded"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--text-ghost)',
                border: '1px solid var(--border-dim)',
              }}
            >
              ESC
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="text-xs truncate"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: info.masked ? 'var(--accent-green-dim)' : 'var(--accent-red)',
              }}
            >
              {info.masked || 'NOT SET'}
            </span>
          </div>
        )}
      </div>

      {/* Edit button */}
      {!editing && (
        <button
          onClick={handleEdit}
          className="px-2 py-1 text-xs rounded flex-shrink-0 transition-colors"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'var(--text-ghost)',
            border: '1px solid var(--border-dim)',
          }}
        >
          EDIT
        </button>
      )}
    </div>
  );
}

// --- Project Path Row (per user) ---
function ProjectPathRow({
  project,
  userId,
  currentPath,
  onSaved,
}: {
  project: Project;
  userId: string;
  currentPath: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentPath);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/user-project-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          project_id: project.id,
          local_path: value,
        }),
      });
      if (res.ok) {
        setEditing(false);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-dim)' }}
    >
      {/* Project name */}
      <div className="w-40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-cyan)' }} />
          <span className="text-sm" style={{ color: 'var(--text-bright)' }}>{project.name}</span>
        </div>
      </div>

      {/* Path */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="/Users/yourname/projects/..."
              className="input-field input-mono flex-1"
              style={{ fontSize: '11px', padding: '4px 8px' }}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="px-3 py-1 text-xs font-semibold rounded disabled:opacity-30"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                background: 'var(--accent-green)',
                color: 'var(--bg-void)',
              }}
            >
              {saving ? '...' : 'SAVE'}
            </button>
            <button
              onClick={() => { setEditing(false); setValue(currentPath); }}
              className="px-2 py-1 text-xs rounded"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-ghost)', border: '1px solid var(--border-dim)' }}
            >
              ESC
            </button>
          </div>
        ) : (
          <span
            className="text-xs"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: currentPath ? 'var(--text-secondary)' : 'var(--accent-red)',
            }}
          >
            {currentPath || 'NOT SET — 경로를 설정해주세요'}
          </span>
        )}
      </div>

      {!editing && (
        <button
          onClick={() => setEditing(true)}
          className="px-2 py-1 text-xs rounded flex-shrink-0"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-ghost)', border: '1px solid var(--border-dim)' }}
        >
          EDIT
        </button>
      )}
    </div>
  );
}

// --- Main Admin Page ---
export default function AdminPage() {
  const { users, selectedUser, selectUser, loading: usersLoading, refreshUsers } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [userPaths, setUserPaths] = useState<UserProjectPath[]>([]);
  const [newProject, setNewProject] = useState({ name: '', repo_url: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setProjects(data))
      .catch(() => {});
  }, []);

  const fetchUserPaths = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/user-project-paths?userId=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) setUserPaths(data);
    } catch {
      setUserPaths([]);
    }
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchUserPaths(selectedUser.id);
    }
  }, [selectedUser, fetchUserPaths]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects((prev) => [project, ...prev]);
        setNewProject({ name: '', repo_url: '', description: '' });
      }
    } finally {
      setSaving(false);
    }
  };

  const getPathForProject = (projectId: string) => {
    return userPaths.find((p) => p.project_id === projectId)?.local_path ?? '';
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-void)' }}>
      <AppHeader />

      <div className="max-w-4xl mx-auto p-6 space-y-10">
        {/* Operator Selection */}
        <section>
          <SectionHeader>OPERATOR SELECT</SectionHeader>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            사용자를 선택하면 해당 사용자의 토큰과 프로젝트 경로가 파이프라인에 적용됩니다.
          </p>

          {usersLoading ? (
            <div className="text-xs" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>LOADING...</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {users.map((user) => {
                const isSelected = selectedUser?.id === user.id;
                const tokenCount = Object.values(user.tokens).filter((t) => t.masked).length;
                const totalTokens = Object.keys(user.tokens).length;

                return (
                  <button
                    key={user.id}
                    onClick={() => selectUser(user.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded text-left transition-all"
                    style={{
                      background: isSelected ? 'var(--accent-green-subtle)' : 'var(--bg-raised)',
                      border: isSelected ? '1px solid var(--accent-green-dim)' : '1px solid var(--border-dim)',
                      boxShadow: isSelected ? '0 0 20px var(--accent-green-glow)' : 'none',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        background: isSelected ? 'var(--accent-green)' : 'var(--bg-surface)',
                        color: isSelected ? 'var(--bg-void)' : 'var(--text-ghost)',
                        border: isSelected ? 'none' : '1px solid var(--border-base)',
                      }}
                    >
                      {user.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: isSelected ? 'var(--text-bright)' : 'var(--text-primary)' }}>
                        {user.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: tokenCount === totalTokens ? 'var(--accent-green-dim)' : 'var(--accent-amber-dim)' }}>
                          {tokenCount}/{totalTokens} TOKENS
                        </span>
                        {isSelected && (
                          <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--accent-green)' }}>ACTIVE</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!usersLoading && !selectedUser && (
            <div
              className="mt-3 px-4 py-2.5 rounded text-xs"
              style={{ background: 'var(--accent-amber-glow)', border: '1px solid var(--accent-amber-dim)', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
            >
              NO OPERATOR SELECTED
            </div>
          )}
        </section>

        {/* API Mode Indicator */}
        {selectedUser && (() => {
          const hChat = selectedUser.tokens.H_CHAT_TOKEN?.masked;
          const anthropic = selectedUser.tokens.ANTHROPIC_API_KEY?.masked;
          const mode = hChat ? 'h-chat' : anthropic ? 'anthropic' : null;

          return (
            <section>
              <SectionHeader>API MODE — {selectedUser.name.toUpperCase()}</SectionHeader>
              <div
                className="flex items-center gap-4 px-4 py-3 rounded"
                style={{
                  background: mode ? 'var(--accent-green-subtle)' : 'var(--accent-red-glow)',
                  border: `1px solid ${mode ? 'var(--accent-green-dim)' : 'var(--accent-red)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: mode ? 'var(--accent-green)' : 'var(--accent-red)' }}
                  />
                  <span
                    className="text-xs font-semibold"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: mode ? 'var(--accent-green)' : 'var(--accent-red)' }}
                  >
                    {mode === 'h-chat' ? 'H-CHAT (autoever)' : mode === 'anthropic' ? 'ANTHROPIC API' : 'NO API KEY'}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {mode === 'h-chat'
                    ? 'H_CHAT_TOKEN 감지 → h-chat-api.autoever.com 경유'
                    : mode === 'anthropic'
                      ? 'ANTHROPIC_API_KEY 감지 → api.anthropic.com 직접 연결'
                      : 'H_CHAT_TOKEN 또는 ANTHROPIC_API_KEY를 아래에서 입력해주세요'}
                </span>
              </div>
            </section>
          );
        })()}

        {/* Token Editing */}
        {selectedUser && (
          <section>
            <SectionHeader>TOKENS — {selectedUser.name.toUpperCase()}</SectionHeader>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              토큰을 직접 편집할 수 있습니다. H_CHAT_TOKEN이 우선 사용되며, 없으면 ANTHROPIC_API_KEY로 동작합니다.
            </p>
            <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border-dim)' }}>
              {Object.entries(selectedUser.tokens).map(([key, info]) => (
                <TokenRow
                  key={key}
                  tokenKey={key}
                  info={info}
                  userId={selectedUser.id}
                  onSaved={refreshUsers}
                />
              ))}
            </div>
          </section>
        )}

        {/* User Project Paths */}
        {selectedUser && projects.length > 0 && (
          <section>
            <SectionHeader>PROJECT PATHS — {selectedUser.name.toUpperCase()}</SectionHeader>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              각 프로젝트의 로컬 경로를 설정하세요. 파이프라인 실행 시 이 경로의 코드베이스를 대상으로 작업합니다.
            </p>
            <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border-dim)' }}>
              {projects.map((project) => (
                <ProjectPathRow
                  key={project.id}
                  project={project}
                  userId={selectedUser.id}
                  currentPath={getPathForProject(project.id)}
                  onSaved={() => fetchUserPaths(selectedUser.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Project Registry */}
        <section>
          <SectionHeader>PROJECT REGISTRY</SectionHeader>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            팀 공용 프로젝트 목록입니다. 로컬 경로는 사용자별로 위에서 설정합니다.
          </p>

          <form
            onSubmit={handleAddProject}
            className="flex gap-2 mb-4 p-4 rounded"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)' }}
          >
            <input type="text" value={newProject.name} onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))} placeholder="프로젝트 이름 *" required className="input-field flex-1" />
            <input type="text" value={newProject.repo_url} onChange={(e) => setNewProject((p) => ({ ...p, repo_url: e.target.value }))} placeholder="GitLab URL" className="input-field input-mono flex-1" />
            <input type="text" value={newProject.description} onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))} placeholder="설명" className="input-field flex-1" />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold rounded disabled:opacity-30 flex-shrink-0"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', background: 'var(--accent-green)', color: 'var(--bg-void)' }}
            >
              ADD
            </button>
          </form>

          <div className="space-y-1">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-2.5 rounded"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-cyan)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-bright)' }}>{p.name}</span>
                  {p.repo_url && (
                    <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-ghost)' }}>
                      {p.repo_url}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-xs py-4 text-center" style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}>
                NO PROJECTS REGISTERED
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
