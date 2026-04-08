'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { GenStageEditor, type GenStage } from '@/components/pipelines/GenStageEditor';
import { ExecutionPlanPreview } from '@/components/pipelines/ExecutionPlanPreview';
import { AiEditPanel } from '@/components/pipelines/AiEditPanel';
import { AiPanelToggle } from '@/components/pipelines/AiPanelToggle';
import type { InputSchema } from '@/components/session-form-fields';

export default function GenericPipelinePage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName);
  const router = useRouter();

  const [stages, setStages] = useState<GenStage[]>([]);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [inputSchema, setInputSchema] = useState<InputSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [aiOpen, setAiOpen] = useState(true);
  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Ref for AI panel context (includes inputSchema)
  const configRef = useRef({ stages, label, description, inputSchema });
  configRef.current = { stages, label, description, inputSchema };
  const getContent = useCallback(
    () => JSON.stringify(configRef.current, null, 2),
    [],
  );

  useEffect(() => {
    setLoading(true);
    setRenaming(false);
    setRenameValue('');
    fetch(`/api/pipelines/generic/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(data => {
        setStages(data.stages ?? []);
        setLabel(data.label ?? name);
        setDescription(data.description ?? '');
        setInputSchema(data.inputSchema ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [name]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    await fetch(`/api/pipelines/generic/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stages, label, description, inputSchema }),
    });
    setSaving(false);
    setSaveMsg('저장됨');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const handleRename = async () => {
    const newName = renameValue.trim();
    if (!newName || newName === name) { setRenaming(false); return; }
    const res = await fetch(`/api/pipelines/generic/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`이름 변경 실패: ${err.error ?? res.status}`);
      return;
    }
    setRenaming(false);
    setRenameValue('');
    router.push(`/pipelines/generic/${encodeURIComponent(newName)}`);
  };

  const handleDelete = async () => {
    if (!confirm(`"${name}" 파이프라인을 삭제할까요?\n이 파이프라인을 참조하는 특수 규칙에서도 연결이 해제됩니다.`)) return;
    await fetch(`/api/pipelines/generic/${encodeURIComponent(name)}`, { method: 'DELETE' });
    router.push('/pipelines');
  };

  const handleAiApply = useCallback(async (text: string) => {
    try {
      const parsed = JSON.parse(text);
      // Update local state
      const newStages = Array.isArray(parsed.stages) ? parsed.stages : stages;
      const newLabel = parsed.label !== undefined ? parsed.label : label;
      const newDescription = parsed.description !== undefined ? parsed.description : description;
      const newInputSchema = parsed.inputSchema !== undefined ? parsed.inputSchema : inputSchema;

      if (Array.isArray(parsed.stages)) setStages(parsed.stages);
      if (parsed.label !== undefined) setLabel(parsed.label);
      if (parsed.description !== undefined) setDescription(parsed.description);
      if (parsed.inputSchema !== undefined) setInputSchema(parsed.inputSchema);

      // Auto-save to filesystem
      setSaving(true);
      await fetch(`/api/pipelines/generic/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stages: newStages,
          label: newLabel,
          description: newDescription,
          inputSchema: newInputSchema,
        }),
      });
      setSaving(false);
      setSaveMsg('적용 · 저장됨');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch { /* ignore invalid JSON */ }
  }, [name, stages, label, description, inputSchema]);

  return (
    <div className="flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '3px', padding: '2px 7px' }}>GENERIC</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{name}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>· 파이프라인 구성</span>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-green)' }}>{saveMsg}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', padding: '6px 16px', borderRadius: '4px', background: 'var(--accent-cyan)', color: 'var(--bg-void)', border: 'none', opacity: saving ? 0.6 : 1, cursor: 'pointer' }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>로딩 중...</div>
          ) : (
            <div className="flex flex-col gap-4" style={{ maxWidth: '700px' }}>
              {/* Name with inline rename */}
              <div className="flex items-center gap-2">
                {renaming ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-bright)', background: 'var(--bg-surface)', border: '1px solid var(--accent-cyan)', borderRadius: '5px', padding: '4px 10px', flex: 1, outline: 'none' }}
                      autoFocus
                    />
                    <button onClick={handleRename} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--bg-void)', background: 'var(--accent-cyan)', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}>저장</button>
                    <button onClick={() => setRenaming(false)} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '4px', padding: '5px 8px', cursor: 'pointer' }}>ESC</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700, color: 'var(--text-bright)' }}>{name}</span>
                    <button
                      onClick={() => { setRenameValue(name); setRenaming(true); }}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}
                    >
                      이름 수정
                    </button>
                  </>
                )}
              </div>

              {/* Label field */}
              <div className="flex flex-col gap-1">
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>LABEL</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="표시 이름 (예: 신규스펙개발)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-void)', border: '1px solid var(--border-base)', borderRadius: '4px', color: 'var(--text-primary)', padding: '6px 10px', outline: 'none', width: '100%' }}
                />
              </div>

              {/* Description field */}
              <div className="flex flex-col gap-1">
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>DESCRIPTION</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="파이프라인 설명 (선택)"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-void)', border: '1px solid var(--border-base)', borderRadius: '4px', color: 'var(--text-primary)', padding: '6px 10px', outline: 'none', width: '100%' }}
                />
              </div>

              {/* Stage editor */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  PIPELINE STAGES
                </div>
                <GenStageEditor stages={stages} onChange={setStages} />
              </div>

              {/* Stage prompt links */}
              {stages.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    STAGE PROMPTS
                  </div>
                  <div className="flex flex-col gap-1">
                    {stages.map((stage) => (
                      <div key={stage.id} className="flex items-center justify-between" style={{ padding: '6px 10px', background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: '4px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)' }}>{stage.id}.md</span>
                        <Link
                          href={`/pipelines/generic/${encodeURIComponent(name)}/${encodeURIComponent(stage.id)}`}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-overlay)', border: '1px solid var(--border-base)', borderRadius: '3px', padding: '2px 8px', textDecoration: 'none', cursor: 'pointer' }}
                        >
                          → 편집
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Schema display */}
              {inputSchema && Array.isArray(inputSchema.fields) && inputSchema.fields.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    INPUT SCHEMA
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    세션 생성 시 사용자에게 보여지는 입력 필드입니다. AI 어시스턴트로 수정 가능합니다.
                  </div>
                  <div className="flex flex-col gap-1">
                    {inputSchema.fields.map((field) => {
                      const isParallelInput = field.type === 'repeat-group';
                      const accentColor =
                        field.type === 'repeat-group' ? '#a78bfa' :
                        field.type === 'checkbox' ? 'var(--accent-green)' :
                        field.type === 'radio' ? 'var(--accent-cyan)' :
                        field.type === 'file' ? '#fb923c' :
                        'var(--text-muted)';
                      const accentBg =
                        field.type === 'repeat-group' ? 'rgba(139,92,246,0.1)' :
                        field.type === 'checkbox' ? 'rgba(0,230,118,0.1)' :
                        field.type === 'radio' ? 'rgba(0,229,255,0.1)' :
                        field.type === 'file' ? 'rgba(251,146,60,0.1)' :
                        'var(--bg-surface)';
                      const accentBorder =
                        field.type === 'repeat-group' ? 'rgba(139,92,246,0.25)' :
                        field.type === 'checkbox' ? 'rgba(0,230,118,0.25)' :
                        field.type === 'radio' ? 'rgba(0,229,255,0.25)' :
                        field.type === 'file' ? 'rgba(251,146,60,0.25)' :
                        'var(--border-dim)';
                      return (
                        <div key={field.id} style={{ padding: '8px 10px', background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: '5px' }}>
                          <div className="flex items-center gap-2">
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{field.label}</span>
                            {field.required && <span style={{ fontSize: '10px', color: 'var(--accent-green)' }}>필수</span>}
                            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', color: accentColor, background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: '3px', padding: '1px 6px' }}>
                              {field.type}
                            </span>
                          </div>
                          {isParallelInput && field.fields && (
                            <div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '2px solid rgba(139,92,246,0.2)' }}>
                              {field.fields.map((sf) => (
                                <div key={sf.id} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', padding: '1px 0' }}>
                                  {sf.id}: {sf.label}
                                </div>
                              ))}
                            </div>
                          )}
                          {field.type === 'radio' && field.options && (
                            <div style={{ marginTop: '6px', paddingLeft: '12px', borderLeft: '2px solid rgba(0,229,255,0.2)' }}>
                              {field.options.map((opt) => (
                                <div key={opt.value} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', padding: '1px 0' }}>
                                  {opt.value}: {opt.label}
                                  {field.default === opt.value && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--accent-green)' }}>기본값</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {field.type === 'checkbox' && typeof field.default !== 'undefined' && (
                            <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                              기본값: {String(field.default)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Execution plan preview */}
              {stages.length > 0 && (
                <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '10px' }}>EXECUTION PLAN PREVIEW</div>
                  <ExecutionPlanPreview stages={stages} />
                </div>
              )}

              {/* Delete button */}
              <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-dim)' }}>
                <button
                  onClick={handleDelete}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#f87171', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer' }}
                >
                  파이프라인 삭제
                </button>
              </div>
            </div>
          )}
        </div>

        <AiPanelToggle open={aiOpen} onToggle={() => setAiOpen(v => !v)} />

        {aiOpen && (
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <AiEditPanel
              context={{ type: 'pipeline', pipelineName: name, getContent }}
              onApply={handleAiApply}
            />
          </div>
        )}
      </div>
    </div>
  );
}
