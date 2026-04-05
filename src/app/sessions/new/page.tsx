'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import { useUser } from '@/contexts/UserContext';
import {
  FieldLabel,
  FormLabel,
  ListField,
  TextareaField,
  RepeatGroupField,
  CheckboxField,
  RadioField,
  type InputField,
  type InputSchema,
  type FieldValue,
} from '@/components/session-form-fields';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  repo_url?: string;
}

interface GenericTaskType {
  taskType: string;
  stageCount: number;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewSessionPage() {
  const router = useRouter();
  const { selectedUser, apiMode: globalApiMode, currentModel } = useUser();

  // Pipeline/project data
  const [projects, setProjects] = useState<Project[]>([]);
  const [specials, setSpecials] = useState<string[]>([]);
  const [genericTaskTypes, setGenericTaskTypes] = useState<GenericTaskType[]>([]);

  // Left column selections
  const [selectedGeneric, setSelectedGeneric] = useState('');
  const [selectedSpecial, setSelectedSpecial] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [apiMode, setApiMode] = useState<'h-chat' | 'claude-max' | 'anthropic'>(globalApiMode);

  // Dynamic schema
  const [inputSchema, setInputSchema] = useState<InputSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Dynamic field values
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({});

  // Legacy fields (when no schema)
  const [branchName, setBranchName] = useState('');
  const [baseBranch, setBaseBranch] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // Load projects + pipelines + specials on mount
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setProjects(d))
      .catch(() => {});
    fetch('/api/pipelines')
      .then((r) => r.json())
      .then((d) => {
        setGenericTaskTypes((d.genericTaskTypes ?? []) as GenericTaskType[]);
      })
      .catch(() => {});
    fetch('/api/specials')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setSpecials(d))
      .catch(() => {});
  }, []);

  // Load input schema when generic pipeline changes
  useEffect(() => {
    if (!selectedGeneric) {
      setInputSchema(null);
      setFieldValues({});
      return;
    }
    setSchemaLoading(true);
    fetch(`/api/pipelines/generic/${encodeURIComponent(selectedGeneric)}`)
      .then((r) => r.json())
      .then((d) => {
        const schema = d.inputSchema as InputSchema | null;
        setInputSchema(schema ?? null);
        // Initialize field values
        if (schema?.fields) {
          const init: Record<string, FieldValue> = {};
          for (const f of schema.fields) {
            if (f.type === 'repeat-group') {
              // Start with one empty item
              const empty: Record<string, string> = {};
              for (const sf of f.fields ?? []) empty[sf.id] = '';
              init[f.id] = [empty];
            } else if (f.type === 'text-list' || f.type === 'url-list') {
              init[f.id] = [];
            } else if (f.type === 'checkbox') {
              init[f.id] = typeof f.default === 'boolean' ? f.default : false;
            } else if (f.type === 'radio') {
              init[f.id] = typeof f.default === 'string'
                ? f.default
                : (f.options?.[0]?.value ?? '');
            } else {
              init[f.id] = '';
            }
          }
          setFieldValues(init);
        } else {
          setFieldValues({});
        }
      })
      .catch(() => setInputSchema(null))
      .finally(() => setSchemaLoading(false));
  }, [selectedGeneric]);

  const setFieldValue = useCallback((id: string, value: FieldValue) => {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Determine session name
    const firstTextValue = Object.values(fieldValues).find((v) => typeof v === 'string' && v.trim());
    const resolvedName =
      sessionName.trim() ||
      branchName.trim() ||
      (typeof firstTextValue === 'string' ? firstTextValue.slice(0, 40) : '') ||
      notes.slice(0, 40) ||
      (selectedGeneric ? `${selectedGeneric} 세션` : selectedSpecial ? `${selectedSpecial} 세션` : '새 세션');

    // Build pipeline_inputs — serialize repeat-group to JSON string
    let pipeline_inputs: Record<string, string | string[] | boolean> | undefined;
    if (inputSchema?.fields.length) {
      const entries: [string, string | string[] | boolean][] = [];
      for (const [key, val] of Object.entries(fieldValues)) {
        if (typeof val === 'boolean') {
          // checkbox → always include (both true/false are meaningful)
          entries.push([key, val]);
        } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
          // repeat-group → JSON string
          const filtered = (val as Record<string, string>[]).filter((obj) =>
            Object.values(obj).some((v) => v.trim()),
          );
          if (filtered.length > 0) {
            entries.push([key, JSON.stringify(filtered)]);
          }
        } else if (Array.isArray(val)) {
          // string[] list
          const filtered = (val as string[]).filter((s) => s.trim());
          if (filtered.length > 0) entries.push([key, filtered]);
        } else if (typeof val === 'string' && val.trim()) {
          entries.push([key, val]);
        }
      }
      if (entries.length > 0) pipeline_inputs = Object.fromEntries(entries) as Record<string, string | string[] | boolean>;
    }

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: resolvedName,
          project_id: selectedProjectId || undefined,
          form_data: {
            generic_pipeline: selectedGeneric || undefined,
            special_rule: selectedSpecial || undefined,
            branch_name: branchName || undefined,
            base_branch: baseBranch || undefined,
            notes: notes || undefined,
            pipeline_inputs,
            api_mode: apiMode,
          },
        }),
      });

      if (!res.ok) {
        setSubmitting(false);
        return;
      }

      const session = await res.json();

      // Auto-run
      fetch(`/api/sessions/${session.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser?.id ?? null,
          apiMode,
          model: currentModel,
        }),
      }).catch(() => {});

      router.push(`/sessions/${session.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Validation
  const hasRequiredFields = inputSchema?.fields
    ? inputSchema.fields
        .filter((f) => f.required)
        .every((f) => {
          const v = fieldValues[f.id];
          if (f.type === 'repeat-group') {
            return (
              Array.isArray(v) &&
              v.length > 0 &&
              (v as Record<string, string>[]).some((obj) =>
                Object.values(obj).some((val) => val.trim()),
              )
            );
          }
          if (f.type === 'checkbox') return true; // checkbox always satisfies required (has default value)
          if (f.type === 'radio') return typeof v === 'string' && v.length > 0;
          if (Array.isArray(v)) return v.some((s) => typeof s === 'string' && s.trim());
          return typeof v === 'string' && v.trim();
        })
    : !!notes.trim();

  const specialOnlyWarning = selectedSpecial && !selectedGeneric;
  const canSubmit = !submitting && hasRequiredFields;

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: 'var(--bg-void)',
        padding: '32px',
      }}
    >
      <form onSubmit={handleSubmit} style={{ maxWidth: '1040px', margin: '0 auto' }}>

        {/* Page title */}
        <div style={{ marginBottom: '28px' }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-green)',
                boxShadow: '0 0 10px var(--accent-green)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-bright)',
              }}
            >
              NEW SESSION
            </span>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '6px',
              marginLeft: '20px',
            }}
          >
            파이프라인을 선택하고 실행에 필요한 입력값을 작성하세요.
          </p>
        </div>

        {/* 2-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>

          {/* ── Left column: pipeline + settings ── */}
          <div
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-base)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                파이프라인
              </span>
            </div>

            <div>
              <FormLabel optional>파이프라인</FormLabel>
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

            <div>
              <FormLabel optional>특수 규칙</FormLabel>
              <Select
                value={selectedSpecial}
                onChange={setSelectedSpecial}
                placeholder="선택"
                options={specials.map((name) => ({
                  value: name,
                  label: name,
                }))}
              />
              {specialOnlyWarning && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-amber, #f59e0b)', marginTop: '4px' }}>
                  파이프라인도 함께 선택해주세요
                </p>
              )}
            </div>

            <div style={{ height: '1px', background: 'var(--border-dim)' }} />

            <div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                설정
              </span>
            </div>

            <div>
              <FormLabel optional>프로젝트</FormLabel>
              <Select
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                placeholder="선택 (코드 작업 없으면 생략)"
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>

            <div>
              <FormLabel optional>세션명</FormLabel>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="미입력 시 자동 설정"
                className="input-field w-full"
              />
            </div>

            <div>
              <FormLabel>API 모드</FormLabel>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(
                  [
                    { value: 'claude-max', label: 'MAX' },
                    { value: 'h-chat', label: 'H-CHAT' },
                    { value: 'anthropic', label: 'API' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setApiMode(opt.value)}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
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
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: '100%',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '11px',
                borderRadius: '6px',
                background: canSubmit ? 'var(--accent-green)' : 'var(--border-base)',
                color: canSubmit ? 'var(--bg-void)' : 'var(--text-muted)',
                border: 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                boxShadow: canSubmit ? '0 0 16px rgba(0,230,118,0.25)' : 'none',
                marginTop: '4px',
              }}
            >
              {submitting ? 'CREATING...' : 'CREATE SESSION'}
            </button>
          </div>

          {/* ── Right column: dynamic fields ── */}
          <div
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-base)',
              borderRadius: '10px',
              padding: '20px',
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                입력 필드
                {selectedGeneric && inputSchema && (
                  <span
                    style={{
                      marginLeft: '8px',
                      color: 'var(--accent-green)',
                      background: 'rgba(0,230,118,0.08)',
                      border: '1px solid rgba(0,230,118,0.25)',
                      borderRadius: '3px',
                      padding: '1px 6px',
                      fontSize: '10px',
                    }}
                  >
                    {selectedGeneric}
                  </span>
                )}
              </span>
            </div>

            {/* State: no pipeline selected */}
            {!selectedGeneric && !selectedSpecial && (
              <div
                style={{
                  padding: '48px 0',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                }}
              >
                왼쪽에서 파이프라인을 선택하면
                <br />
                입력 항목이 표시됩니다.
              </div>
            )}

            {/* State: loading schema */}
            {selectedGeneric && schemaLoading && (
              <div
                style={{
                  padding: '48px 0',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                입력 스키마 로딩 중...
              </div>
            )}

            {/* State: generic pipeline with schema */}
            {selectedGeneric && !schemaLoading && inputSchema?.fields?.length && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {inputSchema.fields.map((field) => (
                  <div key={field.id}>
                    {field.type !== 'checkbox' && (
                      <FieldLabel required={field.required}>{field.label}</FieldLabel>
                    )}
                    {field.type === 'text' && (
                      <input
                        type="text"
                        value={(fieldValues[field.id] as string) ?? ''}
                        onChange={(e) => setFieldValue(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="input-field w-full"
                      />
                    )}
                    {field.type === 'url' && (
                      <input
                        type="url"
                        value={(fieldValues[field.id] as string) ?? ''}
                        onChange={(e) => setFieldValue(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        className="input-field input-mono w-full"
                      />
                    )}
                    {field.type === 'textarea' && (
                      <TextareaField
                        value={(fieldValues[field.id] as string) ?? ''}
                        onChange={(v) => setFieldValue(field.id, v)}
                        placeholder={field.placeholder}
                      />
                    )}
                    {(field.type === 'url-list' || field.type === 'text-list') && (
                      <ListField
                        value={(fieldValues[field.id] as string[]) ?? []}
                        onChange={(v) => setFieldValue(field.id, v)}
                        placeholder={field.placeholder}
                        type={field.type}
                      />
                    )}
                    {field.type === 'repeat-group' && field.fields && (
                      <RepeatGroupField
                        value={(fieldValues[field.id] as Record<string, string>[]) ?? []}
                        onChange={(v) => setFieldValue(field.id, v)}
                        subFields={field.fields}
                        groupLabel={field.label}
                      />
                    )}
                    {field.type === 'checkbox' && (
                      <CheckboxField
                        value={(fieldValues[field.id] as boolean) ?? false}
                        onChange={(v) => setFieldValue(field.id, v)}
                        label={field.label}
                        description={field.description ?? field.placeholder}
                      />
                    )}
                    {field.type === 'radio' && field.options && (
                      <RadioField
                        value={(fieldValues[field.id] as string) ?? ''}
                        onChange={(v) => setFieldValue(field.id, v)}
                        options={field.options}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* State: generic pipeline with no schema — fallback to notes */}
            {selectedGeneric && !schemaLoading && !inputSchema?.fields?.length && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <FormLabel optional>브랜치명</FormLabel>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="feature/my-branch"
                    className="input-field input-mono w-full"
                  />
                </div>
                <div>
                  <FormLabel>작업 내용</FormLabel>
                  <TextareaField value={notes} onChange={setNotes} placeholder="작업 내용을 입력하세요" />
                </div>
              </div>
            )}

            {/* State: special rule selected (no schema) */}
            {selectedSpecial && !selectedGeneric && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <FormLabel optional>브랜치명</FormLabel>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="feature/my-branch"
                    className="input-field input-mono w-full"
                  />
                </div>
                <div>
                  <FormLabel>작업 내용</FormLabel>
                  <TextareaField value={notes} onChange={setNotes} placeholder="작업 내용을 입력하세요" />
                </div>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
