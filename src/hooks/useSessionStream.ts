'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface StreamLogEntry {
  content: string;
  timestamp: string;
  eventType: string;
}

export interface StreamState {
  logs: StreamLogEntry[];
  activeStageId: string | null;
  status: string;
  userGatePrompt: string | null;
  isConnected: boolean;
  claudeSessionId: string | null;
}

export function useSessionStream(sessionId: string | null, initialStageId?: string | null) {
  const [state, setState] = useState<StreamState>({
    logs: [],
    activeStageId: initialStageId ?? null,
    status: 'idle',
    userGatePrompt: null,
    isConnected: false,
    claudeSessionId: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const connect = useCallback((resetState = false) => {
    if (!sessionId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Reset state only when switching sessions (not on reconnect after error)
    if (resetState) {
      setState({
        logs: [],
        activeStageId: initialStageId ?? null,
        status: 'idle',
        userGatePrompt: null,
        isConnected: false,
        claudeSessionId: null,
      });
    }

    const es = new EventSource(`/api/sessions/${sessionId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setState((prev) => ({ ...prev, isConnected: true }));
    };

    es.addEventListener('log', (event) => {
      const data = JSON.parse(event.data);
      setState((prev) => ({
        ...prev,
        logs: [
          ...prev.logs,
          {
            content: data.content,
            timestamp: data.timestamp ?? new Date().toISOString(),
            eventType: 'log',
          },
        ],
      }));
    });

    es.addEventListener('progress', (event) => {
      const data = JSON.parse(event.data);
      if (data.stageId) {
        // New orchestrator: stage-id based progress
        setState((prev) => ({ ...prev, activeStageId: data.stageId }));
      }
      // Legacy step-based progress ignored for progress bar (still in logs)
    });

    es.addEventListener('usergate', (event) => {
      const data = JSON.parse(event.data);
      setState((prev) => ({
        ...prev,
        userGatePrompt: data.prompt ?? data.content,
        status: 'paused',
      }));
    });

    es.addEventListener('status', (event) => {
      const data = JSON.parse(event.data);
      setState((prev) => ({
        ...prev,
        status: data.status,
        userGatePrompt:
          data.status === 'running' ? null : prev.userGatePrompt,
      }));
    });

    es.addEventListener('claude_session_id', (event) => {
      const data = JSON.parse(event.data);
      setState((prev) => ({ ...prev, claudeSessionId: data.claudeSessionId }));
    });

    es.addEventListener('done', () => {
      es.close();
      setState((prev) => ({ ...prev, isConnected: false }));
    });

    es.onerror = () => {
      setState((prev) => ({ ...prev, isConnected: false }));
      es.close();
      // Reconnect after 3 seconds (without resetting state — history replay will restore it)
      setTimeout(() => connect(false), 3000);
    };
  }, [sessionId, initialStageId]);

  useEffect(() => {
    connect(true); // reset state when sessionId changes
    return () => {
      eventSourceRef.current?.close();
    };
  }, [connect]);

  const clearLogs = useCallback(() => {
    setState((prev) => ({ ...prev, logs: [] }));
  }, []);

  return { ...state, logsEndRef, clearLogs };
}
