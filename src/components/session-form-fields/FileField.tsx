'use client';

import { useRef, useState } from 'react';

interface FileFieldProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}

/** File upload field with drag-and-drop, thumbnails for images. */
export function FileField({ files, onFilesChange, accept, multiple = true }: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    onFilesChange(multiple ? [...files, ...arr] : arr.slice(0, 1));
  };

  const removeFile = (idx: number) => {
    onFilesChange(files.filter((_, i) => i !== idx));
  };

  const isImage = (file: File) => file.type.startsWith('image/');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        style={{
          padding: '20px',
          borderRadius: '8px',
          border: `2px dashed ${dragOver ? 'var(--accent-cyan)' : 'var(--border-base)'}`,
          background: dragOver ? 'rgba(0,229,255,0.04)' : 'var(--bg-void)',
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          클릭 또는 드래그하여 파일 추가
          {accept && <span style={{ display: 'block', fontSize: '11px', opacity: 0.6 }}>{accept}</span>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {files.map((file, idx) => (
            <div
              key={`${file.name}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 10px',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border-dim)',
                borderRadius: '6px',
              }}
            >
              {/* Thumbnail for images */}
              {isImage(file) && (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  style={{
                    width: '36px',
                    height: '36px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    flexShrink: 0,
                    border: '1px solid var(--border-dim)',
                  }}
                />
              )}

              {/* File info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {file.name}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                }}>
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  border: '1px solid transparent',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                ×
              </button>
            </div>
          ))}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
            {files.length}개 파일
          </div>
        </div>
      )}
    </div>
  );
}
