import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { aliasPublicIdentity } from '../services/publicContent';

function isAllowedReturnOrigin(origin: string) {
  const allowedReturnOrigins = new Set([
    window.location.origin,
    'https://miruai.vercel.app',
    'https://miruai-web.vercel.app',
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
    console.log('[PublicReturn] effect fired, processedRef =', processedRef.current);
    if (processedRef.current) {
      console.log('[PublicReturn] SKIPPED — already processed');
      return;
    }
    processedRef.current = true;

    const anonymousId = searchParams.get('anonymous_id');
    const sessionId = searchParams.get('session_id');
    const returnTo = sanitizeReturnTo(searchParams.get('return_to'));
    console.log('[PublicReturn] returnTo =', returnTo);

    // Fire-and-forget: alias identity in background, don't block redirect
    if (anonymousId) {
      aliasPublicIdentity({
        anonymous_id: anonymousId,
        session_id: sessionId,
      }).catch(() => { });
    }

    // Build redirect URL, passing token so Next.js can capture auth state
    const token = localStorage.getItem('access_token');
    let redirectUrl = returnTo;
    if (token) {
      try {
        const url = new URL(returnTo);
        url.searchParams.set('miru_token', token);
        redirectUrl = url.toString();
      } catch {
        // returnTo is a relative path (e.g. /chat), no token passing needed
      }
    }

    // Redirect immediately — never wait for the API call
    console.log('[PublicReturn] REDIRECTING NOW to:', redirectUrl);
    window.location.replace(redirectUrl);
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
