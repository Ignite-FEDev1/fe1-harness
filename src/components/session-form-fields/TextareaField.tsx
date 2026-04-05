'use client';

import { useState, useRef } from 'react';

/** Textarea with optional .md file upload button. */
export function TextareaField({
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
