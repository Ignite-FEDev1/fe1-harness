'use client';

import { useState, useCallback } from 'react';
import { FileField } from './FileField';
import type { InputField } from './types';

/**
 * Card-based repeatable group field.
 * Each card contains the defined sub-fields; cards can be added/removed.
 * Used for pipelines with N-item parallel stages.
 */
export function RepeatGroupField({
  value,
  onChange,
  subFields,
  groupLabel,
  fileState,
  onFileStateChange,
}: {
  value: Record<string, string>[];
  onChange: (v: Record<string, string>[]) => void;
  subFields: InputField[];
  groupLabel: string;
  /** Per-card file state: { cardIdx: { fieldId: File[] } } */
  fileState?: Record<number, Record<string, File[]>>;
  onFileStateChange?: (state: Record<number, Record<string, File[]>>) => void;
}) {
  // Internal file state fallback if not managed externally
  const [internalFileState, setInternalFileState] = useState<Record<number, Record<string, File[]>>>({});
  const files = fileState ?? internalFileState;
  const setFiles = onFileStateChange ?? setInternalFileState;

  const hasFileFields = subFields.some((f) => f.type === 'file');

  const addItem = () => {
    const empty: Record<string, string> = {};
    for (const f of subFields) {
      if (f.type !== 'file') empty[f.id] = '';
    }
    onChange([...value, empty]);
  };

  const updateItem = (idx: number, fieldId: string, val: string) => {
    const next = value.map((item, i) => i === idx ? { ...item, [fieldId]: val } : item);
    onChange(next);
  };

  const updateFiles = useCallback((cardIdx: number, fieldId: string, fieldFiles: File[]) => {
    setFiles({ ...files, [cardIdx]: { ...(files[cardIdx] ?? {}), [fieldId]: fieldFiles } });
  }, [files, setFiles]);

  const removeItem = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
    if (hasFileFields) {
      // Re-index file state after removal
      const newFiles: Record<number, Record<string, File[]>> = {};
      for (const [key, val] of Object.entries(files)) {
        const k = Number(key);
        if (k < idx) newFiles[k] = val;
        else if (k > idx) newFiles[k - 1] = val;
        // k === idx is removed
      }
      setFiles(newFiles);
    }
  };

  // Show first non-empty sub-field value as card summary
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
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
              <div key={sf.id}>
                {sf.type === 'file' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {sf.label}
                    </span>
                    <FileField
                      files={files[idx]?.[sf.id] ?? []}
                      onFilesChange={(f) => updateFiles(idx, sf.id, f)}
                      accept={sf.accept}
                      multiple={sf.multiple ?? true}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

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
