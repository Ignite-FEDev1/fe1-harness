'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AiEditPanel } from '@/components/pipelines/AiEditPanel';
import { AiPanelToggle } from '@/components/pipelines/AiPanelToggle';

export default function GlobalRulesPage() {
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
    fetch('/api/pipelines/global-rules')
      .then(r => r.json())
      .then(data => {
        setContent(data.content ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    await fetch('/api/pipelines/global-rules', {
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '3px', padding: '2px 7px' }}>GLOBAL</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--accent-green)' }}>global-rules.md</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>· 모든 파이프라인에 자동 적용</span>
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
        <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>로딩 중...</div>
          ) : (
            <div className="flex flex-col gap-3" style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                .claude/commands/global-rules.md
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-green)', background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: '5px', padding: '8px 12px', lineHeight: '1.5' }}>
                이 규칙은 어떤 파이프라인이든, 어떤 스테이지든 자동으로 주입됩니다.<br />
                Jira 인증, 공통 컨벤션, 에러 핸들링 등 모든 작업에 공통으로 적용할 규칙을 작성하세요.
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
              context={{ type: 'orchestrator', getContent }}
              onApply={(text) => setContent(text)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
