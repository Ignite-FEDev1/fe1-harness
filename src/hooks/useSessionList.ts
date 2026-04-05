'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export interface SessionListItem {
  id: string;
  name: string;
  status: string;
  current_step: number | null;
  created_at: string;
  updated_at: string;
  projects?: { name: string } | null;
}

export function useSessionList() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Re-fetch when pathname changes (e.g. after creating a new session)
  useEffect(() => {
    fetchSessions();
  }, [pathname, fetchSessions]);

  // Poll when there are active (running/paused) sessions
  useEffect(() => {
    const hasActive = sessions.some(
      (s) => s.status === 'running' || s.status === 'paused',
    );
    if (!hasActive) return;
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions, fetchSessions]);

  return { sessions, loading, refresh: fetchSessions };
}
