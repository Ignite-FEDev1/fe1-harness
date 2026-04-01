'use client';

import { useEffect, useRef, useState } from 'react';
import { LogEntry } from './LogEntry';
import { ProgressBar, PipelineStage } from './ProgressBar';
import { UserGateInput } from './UserGateInput';
import { useSessionStream } from '@/hooks/useSessionStream';

interface StreamingViewProps {
  sessionId: string;
  onRun: (additionalNotes?: string) => void;
  sessionStatus: string;
  stages: PipelineStage[];
}

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  running: { label: 'RUNNING', color: 'var(--accent-green)' },
  paused: { label: 'AWAITING INPUT', color: 'var(--accent-amber)' },
  completed: { label: 'COMPLETED', color: 'var(--accent-cyan)' },
  error: { label: 'ERROR', color: 'var(--accent-red, #ff4444)' },
  stopped: { label: 'STOPPED', color: 'var(--accent-amber)' },
  idle: { label: 'IDLE', color: 'var(--text-ghost)' },
};

export function StreamingView({
  sessionId,
  onRun,
  sessionStatus,
  stages,
}: StreamingViewProps) {
  const { logs, activeStageId, status, userGatePrompt, isConnected } =
    useSessionStream(sessionId);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [stopping, setStopping] = useState(false);

  const displayStatus = status || sessionStatus;
  const statusInfo = STATUS_DISPLAY[displayStatus] ?? STATUS_DISPLAY.idle;
  const isRunning = displayStatus === 'running';
  const canRun = displayStatus === 'idle' || displayStatus === 'error' || displayStatus === 'completed' || displayStatus === 'stopped';

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const handleStop = async () => {
    setStopping(true);
    try {
      await fetch(`/api/sessions/${sessionId}/stop`, { method: 'POST' });
    } finally {
      setStopping(false);
    }
  };

  const handleReRun = () => {
    onRun(additionalNotes.trim() || undefined);
    setAdditionalNotes('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Progress Bar */}
      <ProgressBar stages={stages} activeStageId={activeStageId} />

      {/* Status Bar */}
      <div
        className="flex items-center justify-between px-5 py-2"
        style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border-dim)' }}
      >
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: isConnected ? 'var(--accent-green)' : 'var(--text-ghost)',
              boxShadow: isConnected ? '0 0 6px var(--accent-green)' : 'none',
            }}
          />

          {/* Status label */}
          <span
            className={`text-xs font-semibold tracking-wider ${isRunning ? 'status-pulse' : ''}`}
            style={{ color: statusInfo.color, fontFamily: 'var(--font-mono)', fontSize: '10px' }}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Stop button */}
          {isRunning && (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="px-3 py-1 text-xs font-semibold rounded transition-all"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.06em',
                background: 'transparent',
                color: 'var(--accent-amber, #f59e0b)',
                border: '1px solid var(--accent-amber, #f59e0b)',
                opacity: stopping ? 0.5 : 1,
                cursor: stopping ? 'not-allowed' : 'pointer',
              }}
            >
              {stopping ? 'STOPPING...' : '⏹ STOP'}
            </button>
          )}

          {/* Run / Re-run button */}
          {canRun && (
            <button
              onClick={() => onRun()}
              className="px-4 py-1 text-xs font-semibold rounded transition-all"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.06em',
                background: displayStatus === 'idle' ? 'var(--accent-green)' : 'var(--bg-surface)',
                color: displayStatus === 'idle' ? 'var(--bg-void)' : 'var(--text-primary)',
                border: displayStatus === 'idle' ? 'none' : '1px solid var(--border-base)',
                cursor: 'pointer',
              }}
            >
              {displayStatus === 'idle' ? 'EXECUTE' : 'RE-RUN'}
            </button>
          )}
        </div>
      </div>

      {/* Log Output */}
      <div className="flex-1 overflow-y-auto terminal-bg px-2 py-3">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="text-xs"
              style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
            >
              {displayStatus === 'idle' ? (
                <>
                  <span style={{ color: 'var(--accent-green)', opacity: 0.5 }}>{'>'}</span>
                  {' '}READY — EXECUTE TO START PIPELINE
                </>
              ) : (
                'CONNECTING...'
              )}
            </div>
          </div>
        ) : (
          <>
            {logs.map((log, i) => (
              <LogEntry
                key={i}
                content={log.content}
                timestamp={log.timestamp}
              />
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </div>

      {/* Additional context input (shown after stop) */}
      {displayStatus === 'stopped' && (
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-dim)',
            background: 'var(--bg-raised)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: 'var(--accent-amber, #f59e0b)',
              marginBottom: '8px',
            }}
          >
            ⏹ PIPELINE STOPPED — 추가 컨텍스트 입력 후 재시작할 수 있습니다
          </p>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="추가 컨텍스트 (선택 사항) — 예: 파란색 버튼 대신 초록색으로 변경해주세요"
            rows={3}
            className="input-field w-full"
            style={{ resize: 'vertical', lineHeight: '1.6', marginBottom: '10px' }}
          />
          <button
            onClick={handleReRun}
            className="w-full py-2 text-xs font-bold rounded transition-all"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.06em',
              background: 'var(--accent-green)',
              color: 'var(--bg-void)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ▶ RE-RUN
          </button>
        </div>
      )}

      {/* User Gate Input */}
      {userGatePrompt && displayStatus === 'paused' && (
        <UserGateInput
          sessionId={sessionId}
          prompt={userGatePrompt}
          onResponded={() => {}}
        />
      )}
    </div>
  );
}
