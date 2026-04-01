// Stores active Query objects for running sessions (needed for User Gate streamInput)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const activeQueries = new Map<string, any>();

// Tracks sessions that have been requested to stop
const stoppedSessions = new Set<string>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setActiveQuery(sessionId: string, query: any) {
  activeQueries.set(sessionId, query);
}

export function getActiveQuery(sessionId: string) {
  return activeQueries.get(sessionId);
}

export function removeActiveQuery(sessionId: string) {
  activeQueries.delete(sessionId);
}

export function hasActiveQuery(sessionId: string): boolean {
  return activeQueries.has(sessionId);
}

export function stopSession(sessionId: string): void {
  stoppedSessions.add(sessionId);
}

export function isSessionStopped(sessionId: string): boolean {
  return stoppedSessions.has(sessionId);
}

export function clearStopFlag(sessionId: string): void {
  stoppedSessions.delete(sessionId);
}
