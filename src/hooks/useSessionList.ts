'use client';

import { useState, useEffect, useCallback } from 'react';

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

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  return { sessions, loading, refresh: fetchSessions };
}
