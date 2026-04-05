'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/Select';
import { useUser } from '@/contexts/UserContext';

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

interface InputField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'url-list' | 'text-list' | 'repeat-group' | 'checkbox' | 'radio';
  required?: boolean;
  placeholder?: string;
  fields?: InputField[]; // sub-fields for repeat-group
  options?: Array<{ value: string; label: string }>; // for radio
  default?: string | boolean; // default for checkbox (bool) / radio (string)
  description?: string; // small helper text below the field
}

interface InputSchema {
  fields: InputField[];
}

type FieldValue = string | string[] | Record<string, string>[] | boolean;

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
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
      {required && (
        <span style={{ color: 'var(--accent-green)', marginLeft: '4px' }}>*</span>
      )}
    </label>
  );
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
        <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>선택</span>
      )}
    </label>
  );
}

// List field (text-list or url-list)
function ListField({
  value,
  onChange,
  placeholder,
  type,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  type: 'text-list' | 'url-list';
}) {
  const addItem = () => onChange([...value, '']);
  const updateItem = (i: number, v: string) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };
  const removeItem = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const inputType = type === 'url-list' ? 'url' : 'text';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {value.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type={inputType}
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            placeholder={placeholder}
            className="input-field input-mono"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            style={{
              width: '28px',
              height: '28px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              border: '1px solid var(--border-base)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          padding: '5px 10px',
          borderRadius: '4px',
          border: '1px dashed var(--border-base)',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        + 항목 추가
      </button>
    </div>
  );
}

// Textarea with .md upload
function TextareaField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [uploadedFile, setUploadedFile] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange(ev.target?.result as string);
      setUploadedFile(file.name);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px', gap: '8px', alignItems: 'center' }}>
        {uploadedFile && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-green)' }}>
            {uploadedFile}
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
        <input ref={fileInputRef} type="file" accept=".md,.txt" onChange={handleUpload} style={{ display: 'none' }} />
      </div>
      <textarea
        value={value}
        onChange={(e) => { onChange(e.target.value); setUploadedFile(''); }}
        placeholder={placeholder}
        rows={5}
        className="input-field w-full"
        style={{ resize: 'vertical', lineHeight: '1.6' }}
      />
    </div>
  );
}

// ─── Repeat Group Field ─────────────────────────────────────────────────────

function RepeatGroupField({
  value,
  onChange,
  subFields,
  groupLabel,
}: {
  value: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
  subFields: InputField[];
  groupLabel: string;
}) {
  const addItem = () => {
    const empty: Record<string, string> = {};
    for (const f of subFields) empty[f.id] = '';
    onChange([...value, empty]);
  };

  const updateItem = (idx: number, fieldId: string, val: string) => {
    const next = value.map((item, i) => i === idx ? { ...item, [fieldId]: val } : item);
    onChange(next);
  };

  const removeItem = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  // Item name from first non-empty sub-field value, or fallback
  const itemSummary = (item: Record<string, string>) => {
    for (const f of subFields) {
      if (item[f.id]?.trim()) return item[f.id].trim().slice(0, 40);
    }
    return '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {value.map((item, idx) => (
        <div
          key={idx}
          style={{
            background: 'var(--bg-void)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderLeft: '3px solid rgba(139,92,246,0.5)',
            borderRadius: '8px',
            padding: '12px 14px',
            transition: 'border-color 0.15s',
          }}
        >
          {/* Card header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#a78bfa',
                  background: 'rgba(139,92,246,0.12)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  lineHeight: '1.4',
                }}
              >
                #{idx + 1}
              </span>
              {itemSummary(item) && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {itemSummary(item)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              title="삭제"
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
                transition: 'all 0.1s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f87171';
                e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              ×
            </button>
          </div>

          {/* Sub-fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {subFields.map((sf) => (
              <div key={sf.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    minWidth: '80px',
                    flexShrink: 0,
                    textAlign: 'right',
                  }}
                >
                  {sf.label}
                </span>
                <input
                  type="text"
                  value={item[sf.id] ?? ''}
                  onChange={(e) => updateItem(idx, sf.id, e.target.value)}
                  placeholder={sf.placeholder}
                  className="input-field input-mono"
                  style={{ flex: 1, padding: '5px 8px', fontSize: '12px' }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add button */}
      <button
        type="button"
        onClick={addItem}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px dashed rgba(139,92,246,0.3)',
          background: 'rgba(139,92,246,0.04)',
          color: '#a78bfa',
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)';
          e.currentTarget.style.background = 'rgba(139,92,246,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
          e.currentTarget.style.background = 'rgba(139,92,246,0.04)';
        }}
      >
        + {groupLabel} 추가
      </button>

      {value.length > 0 && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            textAlign: 'right',
          }}
        >
          {value.length}개 등록
        </div>
      )}
    </div>
  );
}

// ─── Checkbox Field ─────────────────────────────────────────────────────────

function CheckboxField({
  value,
  onChange,
  label,
  description,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        background: value ? 'rgba(0,230,118,0.06)' : 'var(--bg-void)',
        border: `1px solid ${value ? 'rgba(0,230,118,0.35)' : 'var(--border-base)'}`,
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Toggle switch */}
      <div
        style={{
          width: '32px',
          height: '18px',
          borderRadius: '9px',
          background: value ? 'var(--accent-green)' : 'var(--border-base)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: 'var(--bg-void)',
            position: 'absolute',
            top: '2px',
            left: value ? '16px' : '2px',
            transition: 'left 0.15s',
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 600,
            color: value ? 'var(--text-bright)' : 'var(--text-primary)',
          }}
        >
          {label}
        </div>
        {description && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              marginTop: '2px',
              lineHeight: '1.5',
            }}
          >
            {description}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Radio Field ─────────────────────────────────────────────────────────────

function RadioField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: active ? 700 : 500,
              letterSpacing: '0.04em',
              padding: '7px 14px',
              borderRadius: '6px',
              border: active
                ? '1px solid var(--accent-green)'
                : '1px solid var(--border-base)',
              background: active ? 'rgba(0,230,118,0.1)' : 'var(--bg-void)',
              color: active ? 'var(--accent-green)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
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
