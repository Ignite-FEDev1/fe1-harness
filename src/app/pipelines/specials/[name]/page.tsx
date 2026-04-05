'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AiEditPanel } from '@/components/pipelines/AiEditPanel';

export default function SpecialPage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = decodeURIComponent(rawName);
  const router = useRouter();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const contentRef = useRef(content);
  contentRef.current = content;
  const getContent = useCallback(() => contentRef.current, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/specials/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(data => {
        setContent(data.content ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [name]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    await fetch(`/api/specials/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    setSaveMsg('저장됨');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const handleDelete = async () => {
    if (!confirm(`"${name}" 특수 규칙을 삭제할까요?`)) return;
    await fetch(`/api/specials/${encodeURIComponent(name)}`, { method: 'DELETE' });
    router.push('/pipelines');
  };

  return (
    <div className="flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '3px', padding: '2px 7px' }}>SPECIAL</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-green)' }}>{name}.md</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>· 특수 규칙</span>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-green)' }}>{saveMsg}</span>}
          <button
            onClick={handleDelete}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#f87171', background: 'transparent', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}
          >
            삭제
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', padding: '6px 16px', borderRadius: '4px', background: 'var(--accent-green)', color: 'var(--bg-void)', border: 'none', opacity: saving ? 0.6 : 1, cursor: 'pointer' }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>로딩 중...</div>
          ) : (
            <div className="flex flex-col gap-3" style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                .claude/commands/specials/{name}.md — 자유형식 프로젝트 컨텍스트 및 규칙
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.6', background: 'var(--bg-raised)', border: '1px solid var(--border-base)', borderRadius: '6px', color: 'var(--text-primary)', padding: '16px', resize: 'none', outline: 'none', whiteSpace: 'pre' }}
              />
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <AiEditPanel
            context={{ type: 'special', specialName: name, getContent }}
            onApply={(text) => setContent(text)}
          />
        </div>
      </div>
    </div>
  );
}
