import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, logoutLocal, session } from '../api';
import type { AuthMe } from './types';

interface SessionContextValue {
  profile: AuthMe | null;
  initialized: boolean;
  loading: boolean;
  refreshProfile: () => Promise<AuthMe>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<AuthMe | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshProfile = async (): Promise<AuthMe> => {
    const current = await api<AuthMe>('/api/v1/auth/me');
    setProfile(current);
    return current;
  };

  const logout = async (): Promise<void> => {
    try {
      await api<null>('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      logoutLocal();
      setProfile(null);
    }
  };

  useEffect(() => {
    if (!session()) {
      setInitialized(true);
      return;
    }
    setLoading(true);
    refreshProfile()
      .catch(() => logoutLocal())
      .finally(() => {
        setLoading(false);
        setInitialized(true);
      });
  }, []);

  const value = useMemo(() => ({ profile, initialized, loading, refreshProfile, logout }), [profile, initialized, loading]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used within SessionProvider');
  return value;
}
