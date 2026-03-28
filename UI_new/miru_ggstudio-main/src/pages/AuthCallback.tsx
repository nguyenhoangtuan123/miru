import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AUTH_USER_STORAGE_KEY = 'miru_auth_user';

function sanitizeNextPath(nextPath: string | null, fallback: string) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return fallback;
  }

  return nextPath;
}

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) {
      return;
    }

    hasProcessedRef.current = true;

    const token = searchParams.get('token');
    const nextPath = sanitizeNextPath(searchParams.get('next'), '/chat');

    if (!token) {
      navigate('/auth/login', { replace: true });
      return;
    }

    try {
      // Save token and clear cached user (will be re-fetched by AuthContext)
      localStorage.setItem('access_token', token);
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);

      // Role is already applied server-side — just redirect
      window.location.replace(nextPath);
    } catch (authError) {
      localStorage.removeItem('access_token');
      setError(
        authError instanceof Error
          ? authError.message
          : 'Không thể hoàn tất đăng nhập'
      );
    }
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-miru-bg px-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="w-10 h-10 border-4 border-miru-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-white/70">
          {error ? 'Đăng nhập chưa hoàn tất.' : 'Đang xác thực với Miru...'}
        </p>
        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
