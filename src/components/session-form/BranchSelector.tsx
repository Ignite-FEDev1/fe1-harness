'use client';

import { useState, useEffect } from 'react';
import { Select } from '@/components/ui/Select';

interface BranchSelectorProps {
  gitlabProjectId?: string;
  value: string;
  onChange: (branch: string) => void;
}

interface Branch {
  name: string;
}

export function BranchSelector({ gitlabProjectId, value, onChange }: BranchSelectorProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gitlabProjectId) return;
    setLoading(true);
    fetch(`/api/gitlab/branches?projectId=${encodeURIComponent(gitlabProjectId)}`)
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setBranches(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gitlabProjectId]);

  return (
    <div>
      <label
        className="block text-xs font-medium mb-1.5"
        style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em' }}
      >
        BRANCH
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="feature/main-page"
          className="input-field input-mono flex-1"
        />
        {gitlabProjectId && (
          <Select
            value=""
            onChange={onChange}
            disabled={loading}
            placeholder={loading ? 'LOADING...' : 'SELECT'}
            options={branches.map((b) => ({ value: b.name, label: b.name }))}
          />
        )}
      </div>
    </div>
  );
}
