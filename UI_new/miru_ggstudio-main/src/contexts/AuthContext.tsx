import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../services/api';
import { getCurrentUser } from '../services/backend';

type UserRole = 'client' | 'therapist';
type TherapistStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';
const AUTH_USER_STORAGE_KEY = 'miru_auth_user';

interface User {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  role?: UserRole | null;
  auth_stage?: UserRole | null;
  therapist_status?: TherapistStatus | null;
  can_access_therapist_portal?: boolean;
  is_admin_reviewer?: boolean;
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

  const checkAuth = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void checkAuth();
  }, []);

  const login = (role: UserRole = 'client', nextPath?: string) => {
    const defaultPath = role === 'therapist' ? '/therapist' : '/chat';
    const targetPath = sanitizeNextPath(nextPath ?? defaultPath);

    // Build full auth intent URL — backend now owns role application
    const params = new URLSearchParams({
      intent: role,
      surface: 'app',
      return_to: targetPath,
      entry: 'app_login',
    });

    window.location.href = `${API_BASE_URL}/auth/google/start?${params.toString()}`;
  };

  const logout = async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setUser(null);
    window.location.replace(
      `${API_BASE_URL}/auth/logout?next=${encodeURIComponent('/auth/login')}`
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        checkAuth,
      }}
    >
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
