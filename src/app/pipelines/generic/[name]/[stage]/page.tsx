'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AiEditPanel } from '@/components/pipelines/AiEditPanel';
import { AiPanelToggle } from '@/components/pipelines/AiPanelToggle';

export default function StagePage() {
  const { name: rawName, stage: rawStage } = useParams<{ name: string; stage: string }>();
  const name = decodeURIComponent(rawName);
  const stage = decodeURIComponent(rawStage);

  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [aiOpen, setAiOpen] = useState(true);

  const contentRef = useRef(content);
  contentRef.current = content;
  const getContent = useCallback(() => contentRef.current, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pipelines/generic/${encodeURIComponent(name)}/${encodeURIComponent(stage)}`)
      .then(r => r.json())
      .then(data => {
        setContent(data.content ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [name, stage]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    await fetch(`/api/pipelines/generic/${encodeURIComponent(name)}/${encodeURIComponent(stage)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    setSaveMsg('저장됨');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  return (
    <div className="flex flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-shrink-0" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-base)' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '3px', padding: '2px 7px' }}>GENERIC</span>
          <Link
            href={`/pipelines/generic/${encodeURIComponent(name)}`}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}
          >
            {name}
          </Link>
          <span style={{ color: 'var(--border-base)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{stage}.md</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>· 모든 프로젝트에서 공유</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/pipelines/generic/${encodeURIComponent(name)}`}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-dim)', borderRadius: '4px', padding: '4px 10px', textDecoration: 'none' }}
          >
            ← 파이프라인
          </Link>
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
        <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>로딩 중...</div>
          ) : (
            <div className="flex flex-col gap-3" style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                .claude/commands/generic/{name}/{stage}.md
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: '1.6', background: 'var(--bg-raised)', border: '1px solid var(--border-base)', borderRadius: '6px', color: 'var(--text-primary)', padding: '16px', resize: 'none', outline: 'none', whiteSpace: 'pre' }}
              />
            </div>
          )}
        </div>

        <AiPanelToggle open={aiOpen} onToggle={() => setAiOpen(v => !v)} />

        {aiOpen && (
          <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
            <AiEditPanel
              context={{ type: 'stage', pipelineName: name, stageName: stage, getContent }}
              onApply={async (text) => {
                setContent(text);
                // Auto-save to filesystem
                setSaving(true);
                await fetch(`/api/pipelines/generic/${encodeURIComponent(name)}/${encodeURIComponent(stage)}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: text }),
                });
                setSaving(false);
                setSaveMsg('적용 · 저장됨');
                setTimeout(() => setSaveMsg(''), 2000);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
