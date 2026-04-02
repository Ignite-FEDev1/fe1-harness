'use client';

import { useState, useRef } from 'react';
import { useUser, API_MODE_META, type ApiMode } from '@/contexts/UserContext';
import { AppHeader } from '@/components/layout/AppHeader';

interface LogEntry {
  type: 'log' | 'tool' | 'error' | 'system';
  content: string;
}

interface TestRun {
  apiMode: ApiMode;
  status: 'idle' | 'running' | 'done' | 'error';
  logs: LogEntry[];
  outputDir?: string;
  turns?: number;
  cost?: number;
  startedAt?: string;
}

const MODES: ApiMode[] = ['h-chat', 'claude-max', 'anthropic'];

export default function TestPage() {
  const { selectedUser } = useUser();
  const [runs, setRuns] = useState<Record<ApiMode, TestRun>>(() =>
    Object.fromEntries(MODES.map((m) => [m, { apiMode: m, status: 'idle', logs: [] }])) as unknown as Record<ApiMode, TestRun>
  );
  const abortRefs = useRef<Partial<Record<ApiMode, AbortController>>>({});

  const updateRun = (mode: ApiMode, patch: Partial<TestRun>) => {
    setRuns((prev) => ({ ...prev, [mode]: { ...prev[mode], ...patch } }));
  };

  const appendLog = (mode: ApiMode, entry: LogEntry) => {
    setRuns((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], logs: [...prev[mode].logs, entry] },
    }));
  };

  const runTest = async (mode: ApiMode) => {
    const ctrl = new AbortController();
    abortRefs.current[mode] = ctrl;

    updateRun(mode, {
      status: 'running',
      logs: [],
      outputDir: undefined,
      startedAt: new Date().toISOString(),
    });

    try {
      const res = await fetch('/api/test/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiMode: mode, userId: selectedUser?.id ?? null }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        updateRun(mode, { status: 'error' });
        appendLog(mode, { type: 'error', content: err.error || 'Failed to start' });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.startsWith('data: ')) continue;
          const prevLine = lines[i - 1] ?? '';
          const event = prevLine.startsWith('event: ') ? prevLine.slice(7) : '';

          try {
            const data = JSON.parse(line.slice(6));

            if (event === 'start') {
              appendLog(mode, {
                type: 'system',
                content: `▶ 테스트 시작 — ${data.modeLabel}\n출력 경로: ${data.outputDir}`,
              });
            } else if (event === 'log') {
              appendLog(mode, { type: 'log', content: data.content });
            } else if (event === 'tool') {
              const input = data.name === 'Agent'
                ? String((data.input as Record<string, unknown>)?.description ?? '').slice(0, 80)
                : JSON.stringify(data.input).slice(0, 80);
              appendLog(mode, { type: 'tool', content: `[${data.name}] ${input}` });
            } else if (event === 'error') {
              appendLog(mode, { type: 'error', content: data.message });
            } else if (event === 'result') {
              updateRun(mode, { turns: data.turns, cost: data.cost });
            } else if (event === 'done') {
              updateRun(mode, {
                status: data.success ? 'done' : 'error',
                outputDir: data.outputDir,
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      updateRun(mode, { status: 'error' });
      appendLog(mode, { type: 'error', content: String(err) });
    }
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-void)' }}>
      <AppHeader />

      {/* Description */}
      <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-dim)' }}>
        <p className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          각 API 모드에서 테스트 파이프라인을 실행합니다. Subagent 동작 및 세션 독립성을 검증하며,<br />
          결과는 <code style={{ color: 'var(--accent-green)' }}>test-results/&#123;mode&#125;/&#123;timestamp&#125;/</code> 폴더에 MD 파일로 저장됩니다.
        </p>
      </div>

      {/* Mode cards */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-1 gap-4 max-w-5xl">
          {MODES.map((mode) => {
            const run = runs[mode];
            const meta = API_MODE_META[mode];
            const isRunning = run.status === 'running';

            return (
              <div
                key={mode}
                className="rounded-lg overflow-hidden"
                style={{ background: 'var(--bg-base)', border: `1px solid ${run.status === 'done' ? 'var(--accent-green-glow)' : run.status === 'error' ? 'rgba(239,68,68,0.3)' : 'var(--border-dim)'}` }}
              >
                {/* Card header */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-surface)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: isRunning ? meta.color : run.status === 'done' ? 'var(--accent-green)' : run.status === 'error' ? 'rgb(239,68,68)' : 'var(--text-muted)',
                        boxShadow: isRunning ? `0 0 6px ${meta.color}` : 'none',
                        animation: isRunning ? 'pulse 1.5s infinite' : 'none',
                      }}
                    />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {meta.desc}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {run.status === 'done' && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-green)' }}>
                        ✅ 통과 {run.turns != null ? `(${run.turns}턴)` : ''} {run.cost != null ? `$${run.cost.toFixed(4)}` : ''}
                      </span>
                    )}
                    {run.status === 'error' && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgb(239,68,68)' }}>
                        ❌ 실패
                      </span>
                    )}
                    <button
                      onClick={() => runTest(mode)}
                      disabled={isRunning}
                      className="px-3 py-1 text-xs rounded disabled:opacity-40 transition-all"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        fontWeight: 700,
                        background: isRunning ? 'var(--bg-void)' : meta.color,
                        color: isRunning ? meta.color : 'var(--bg-void)',
                        border: `1px solid ${meta.color}`,
                      }}
                    >
                      {isRunning ? '실행 중...' : run.status === 'done' ? '재실행' : '테스트 실행'}
                    </button>
                  </div>
                </div>

                {/* Log output */}
                <div
                  className="h-48 overflow-y-auto px-4 py-3"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.7 }}
                >
                  {run.logs.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>대기 중 — 테스트 실행 버튼을 눌러 시작하세요</span>
                  ) : (
                    run.logs.map((entry, i) => (
                      <div key={i} style={{
                        color: entry.type === 'error' ? 'rgb(239,68,68)' : entry.type === 'tool' ? 'var(--accent-cyan)' : entry.type === 'system' ? meta.color : 'var(--text-secondary)',
                        opacity: entry.type === 'log' ? 0.8 : 1,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}>
                        {entry.type === 'tool' && <span style={{ opacity: 0.5 }}>▸ </span>}
                        {entry.type === 'system' && <span style={{ opacity: 0.7 }}>◈ </span>}
                        {entry.content}
                      </div>
                    ))
                  )}
                </div>

                {/* Output dir link */}
                {run.outputDir && (
                  <div
                    className="px-4 py-2"
                    style={{ borderTop: '1px solid var(--border-dim)', background: 'var(--bg-void)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                      결과 경로: <span style={{ color: 'var(--accent-green)' }}>{run.outputDir}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
