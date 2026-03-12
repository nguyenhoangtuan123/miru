import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../services/api';
import { getCurrentUser, setUserRole } from '../services/backend';

type UserRole = 'client' | 'therapist';
const AUTH_USER_STORAGE_KEY = 'miru_auth_user';

interface User {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  role?: UserRole | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (role?: UserRole, nextPath?: string) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function sanitizeNextPath(nextPath?: string) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/chat';
  }

  return nextPath;
}

function shouldClearToken(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('not authenticated') ||
    normalized.includes('token') ||
    normalized.includes('unauthorized') ||
    normalized.includes('user not found')
  );
}

function readCachedUser() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return null;
  }

  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readCachedUser());
  const [loading, setLoading] = useState(true);
  const [isSyncingRole, setIsSyncingRole] = useState(false);

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');

    if (!token) {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      setLoading(true);
      const response = await getCurrentUser();
      setUser(response.user);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.user));
      return response.user;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auth check failed';

      if (shouldClearToken(message)) {
        localStorage.removeItem('access_token');
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        setUser(null);
      } else {
        const cachedUser = readCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
        } else {
          setUser(null);
        }
        console.error('Auth check failed:', error);
        return cachedUser;
      }
    } finally {
      setLoading(false);
    }

    return null;
  };

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const pendingRole = localStorage.getItem('pending_role');

    if (!token || !pendingRole || loading || isSyncingRole) {
      return;
    }

    if (pendingRole !== 'client' && pendingRole !== 'therapist') {
      localStorage.removeItem('pending_role');
      return;
    }

    if (user?.role === pendingRole) {
      localStorage.removeItem('pending_role');
      return;
    }

    let cancelled = false;

    const syncPendingRole = async () => {
      try {
        setIsSyncingRole(true);
        await setUserRole(pendingRole);
        await checkAuth();
      } catch (error) {
        console.error('Pending role sync failed:', error);
      } finally {
        if (!cancelled) {
          localStorage.removeItem('pending_role');
          setIsSyncingRole(false);
        }
      }
    };

    void syncPendingRole();

    return () => {
      cancelled = true;
    };
  }, [checkAuth, isSyncingRole, loading, user?.role]);

  const login = (role: UserRole = 'client', nextPath?: string) => {
    const targetPath = sanitizeNextPath(nextPath ?? (role === 'therapist' ? '/therapist' : '/chat'));
    const callbackPath = `/auth/callback?next=${encodeURIComponent(targetPath)}`;

    localStorage.setItem('pending_role', role);
    window.location.href = `${API_BASE_URL}/auth/login?next=${encodeURIComponent(callbackPath)}`;
  };

  const logout = async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('pending_role');
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setUser(null);
    window.location.replace(
      `${API_BASE_URL}/auth/logout?next=${encodeURIComponent('/auth/login')}`
    );
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
