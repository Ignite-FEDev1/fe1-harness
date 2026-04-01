'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

export interface TokenInfo {
  value: string;
  masked: string;
  label: string;
  sensitive: boolean;
  source: string;
}

export interface Fe1User {
  id: string;
  name: string;
  tokens: Record<string, TokenInfo>;
}

export type ApiMode = 'h-chat' | 'anthropic' | 'claude-max';

export const MODEL_OPTIONS: Record<ApiMode, { value: string; label: string }[]> = {
  'h-chat': [
    { value: 'claude-sonnet-4-6', label: 'sonnet·4.6' },
    { value: 'claude-sonnet-4-5', label: 'sonnet·4.5' },
    { value: 'claude-haiku-4-5',  label: 'haiku·4.5'  },
  ],
  'claude-max': [
    { value: 'claude-opus-4-6',          label: 'opus·4.6'   },
    { value: 'claude-sonnet-4-6',         label: 'sonnet·4.6' },
    { value: 'claude-haiku-4-5-20251001', label: 'haiku·4.5'  },
  ],
  'anthropic': [
    { value: 'claude-opus-4-6',          label: 'opus·4.6'   },
    { value: 'claude-sonnet-4-6',         label: 'sonnet·4.6' },
    { value: 'claude-haiku-4-5-20251001', label: 'haiku·4.5'  },
  ],
};

export const DEFAULT_MODEL: Record<ApiMode, string> = {
  'h-chat':     'claude-sonnet-4-6',
  'claude-max': 'claude-opus-4-6',
  'anthropic':  'claude-opus-4-6',
};

export const API_MODE_META: Record<ApiMode, { label: string; desc: string; color: string; bg: string; border: string }> = {
  'h-chat': {
    label: 'H-CHAT',
    desc: '회사 내부 Claude',
    color: 'var(--accent-amber)',
    bg: 'var(--accent-amber-glow)',
    border: 'rgba(245,158,11,0.3)',
  },
  'claude-max': {
    label: 'CLAUDE MAX',
    desc: '로컬 OAuth 세션',
    color: 'var(--accent-green)',
    bg: 'var(--accent-green-subtle)',
    border: 'var(--accent-green-glow)',
  },
  'anthropic': {
    label: 'ANTHROPIC',
    desc: 'API 키 직접 사용',
    color: 'var(--accent-cyan)',
    bg: 'var(--accent-cyan-glow)',
    border: 'rgba(6,182,212,0.3)',
  },
};

interface UserContextValue {
  users: Fe1User[];
  selectedUser: Fe1User | null;
  loading: boolean;
  selectUser: (userId: string) => void;
  refreshUsers: () => Promise<void>;
  apiMode: ApiMode;
  setApiMode: (mode: ApiMode) => void;
  availableModes: ApiMode[];
  modelByMode: Record<ApiMode, string>;
  setModelForMode: (mode: ApiMode, model: string) => void;
  currentModel: string;
}

const UserContext = createContext<UserContextValue>({
  users: [],
  selectedUser: null,
  loading: true,
  selectUser: () => {},
  refreshUsers: async () => {},
  apiMode: 'h-chat',
  setApiMode: () => {},
  availableModes: [],
  modelByMode: DEFAULT_MODEL as Record<ApiMode, string>,
  setModelForMode: () => {},
  currentModel: 'claude-sonnet-4-6',
});

const STORAGE_KEY = 'fe1-harness-selected-user-id';
const API_MODE_KEY = 'fe1-harness-api-mode';
const MODEL_BY_MODE_KEY = 'fe1-harness-model-by-mode';

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<Fe1User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiMode, setApiModeState] = useState<ApiMode>('claude-max');
  const [modelByMode, setModelByModeState] = useState<Record<ApiMode, string>>({ ...DEFAULT_MODEL });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    if (storedUser) setSelectedUserId(storedUser);

    const storedMode = localStorage.getItem(API_MODE_KEY);
    if (storedMode === 'h-chat' || storedMode === 'anthropic' || storedMode === 'claude-max') {
      setApiModeState(storedMode);
    }

    const storedModels = localStorage.getItem(MODEL_BY_MODE_KEY);
    if (storedModels) {
      try {
        const parsed = JSON.parse(storedModels);
        setModelByModeState((prev) => ({ ...prev, ...parsed }));
      } catch { /* ignore */ }
    }
  }, []);

  const selectUser = useCallback((userId: string) => {
    setSelectedUserId(userId);
    localStorage.setItem(STORAGE_KEY, userId);
  }, []);

  const setApiMode = useCallback((mode: ApiMode) => {
    setApiModeState(mode);
    localStorage.setItem(API_MODE_KEY, mode);
  }, []);

  const setModelForMode = useCallback((mode: ApiMode, model: string) => {
    setModelByModeState((prev) => {
      const next = { ...prev, [mode]: model };
      localStorage.setItem(MODEL_BY_MODE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  // Determine available modes — claude-max is always available (local OAuth)
  const availableModes: ApiMode[] = ['claude-max'];
  if (selectedUser) {
    if (selectedUser.tokens.H_CHAT_TOKEN?.masked) availableModes.unshift('h-chat');
    if (selectedUser.tokens.ANTHROPIC_API_KEY?.masked) availableModes.push('anthropic');
  }

  // Auto-correct if current mode is not available
  useEffect(() => {
    if (!availableModes.includes(apiMode)) {
      setApiMode(availableModes[0]);
    }
  }, [availableModes, apiMode, setApiMode]);

  const currentModel = modelByMode[apiMode] ?? DEFAULT_MODEL[apiMode];

  return (
    <UserContext.Provider
      value={{
        users,
        selectedUser,
        loading,
        selectUser,
        refreshUsers: fetchUsers,
        apiMode,
        setApiMode,
        availableModes,
        modelByMode,
        setModelForMode,
        currentModel,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
