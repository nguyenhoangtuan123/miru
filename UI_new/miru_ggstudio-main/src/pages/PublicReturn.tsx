import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { aliasPublicIdentity } from '../services/publicContent';

function isAllowedReturnOrigin(origin: string) {
  const allowedReturnOrigins = new Set([
    window.location.origin,
    'https://miruai.vercel.app',
    'https://app.miruai.vercel.app',
    'https://miruggstudio-main.vercel.app',
    'http://localhost:3001',
    'http://localhost:3000',
  ]);

  if (allowedReturnOrigins.has(origin)) {
    return true;
  }

  return origin.endsWith('.vercel.app');
}

function sanitizeReturnTo(rawValue: string | null) {
  if (!rawValue) {
    return '/chat';
  }

  try {
    const parsed = new URL(rawValue);
    if (isAllowedReturnOrigin(parsed.origin)) {
      return parsed.toString();
    }
  } catch {
    if (rawValue.startsWith('/') && !rawValue.startsWith('//')) {
      return rawValue;
    }
  }

  return '/chat';
}

export function PublicReturn() {
  const [searchParams] = useSearchParams();
  const processedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (processedRef.current) {
      return;
    }
    processedRef.current = true;

    let cancelled = false;

    const run = async () => {
      const anonymousId = searchParams.get('anonymous_id');
      const sessionId = searchParams.get('session_id');
      const returnTo = sanitizeReturnTo(searchParams.get('return_to'));

      try {
        if (anonymousId) {
          await aliasPublicIdentity({
            anonymous_id: anonymousId,
            session_id: sessionId,
          });
        }
      } catch (aliasError) {
        if (!cancelled) {
          setError(
            aliasError instanceof Error
              ? aliasError.message
              : 'Khong the dong bo identity tu public site'
          );
        }
      } finally {
        if (!cancelled) {
          window.location.replace(returnTo);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-miru-bg px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-miru-primary border-t-transparent" />
        <p className="text-white/70">
          {error ? 'Dang quay lai bai viet cua ban...' : 'Dang ket noi lai voi Miru...'}
        </p>
        {error ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
