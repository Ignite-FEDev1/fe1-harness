import { EventEmitter } from 'events';

export interface LogEvent {
  content: string;
  timestamp: string;
}

export interface ProgressEvent {
  // New orchestrator: stage-id based
  stageId?: string;
  // Legacy: step-number based
  step?: number;
  label?: string;
  detail?: string;
}

export interface UserGateEvent {
  prompt: string;
}

export interface StatusEvent {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'stopped';
  error?: string;
}

type SessionEventMap = {
  log: LogEvent;
  progress: ProgressEvent;
  usergate: UserGateEvent;
  status: StatusEvent;
  claude_session_id: { claudeSessionId: string };
  done: Record<string, never>;
};

class PipelineEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit<K extends keyof SessionEventMap>(
    sessionId: string,
    event: K,
    data: SessionEventMap[K],
  ) {
    this.emitter.emit(`${event}:${sessionId}`, data);
  }

  on<K extends keyof SessionEventMap>(
    sessionId: string,
    event: K,
    handler: (data: SessionEventMap[K]) => void,
  ) {
    this.emitter.on(`${event}:${sessionId}`, handler);
  }

  off<K extends keyof SessionEventMap>(
    sessionId: string,
    event: K,
    handler: (data: SessionEventMap[K]) => void,
  ) {
    this.emitter.off(`${event}:${sessionId}`, handler);
  }

  removeAllForSession(sessionId: string) {
    const events: (keyof SessionEventMap)[] = [
      'log',
      'progress',
      'usergate',
      'status',
      'done',
    ];
    for (const event of events) {
      this.emitter.removeAllListeners(`${event}:${sessionId}`);
    }
  }
}

export const pipelineEventBus = new PipelineEventBus();
