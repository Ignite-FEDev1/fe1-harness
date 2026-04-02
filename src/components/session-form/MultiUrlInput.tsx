'use client';

import { useState } from 'react';

interface MultiUrlInputProps {
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
  placeholder?: string;
}

export function MultiUrlInput({
  label,
  value,
  onChange,
  placeholder = 'https://',
}: MultiUrlInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addUrl = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue('');
    }
  };

  const removeUrl = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      <label
        className="block text-xs font-medium mb-1.5"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.04em' }}
      >
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="url"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
          placeholder={placeholder}
          className="input-field input-mono flex-1"
        />
        <button
          type="button"
          onClick={addUrl}
          className="px-3 py-1.5 text-xs font-medium rounded transition-all"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-base)',
          }}
        >
          ADD
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map((url, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="max-w-[200px] truncate">{url}</span>
              <button
                type="button"
                onClick={() => removeUrl(i)}
                className="transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
