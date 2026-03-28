const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8008"
    : "https://web-production-56fc05.up.railway.app";
const DEFAULT_SITE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://miruai-web.vercel.app";
const DEFAULT_APP_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://miruai.vercel.app";

function isLocalhostUrl(value: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value.trim());
}

function normalizeUrl(value: string | undefined, fallback: string) {
  const trimmed = (value || "").trim();

  if (!trimmed) {
    return fallback.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "development" && isLocalhostUrl(trimmed)) {
    return fallback.replace(/\/+$/, "");
  }

  return trimmed.replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL,
  DEFAULT_API_BASE_URL
);

export const SITE_URL = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL, DEFAULT_SITE_URL);
export const APP_URL = normalizeUrl(process.env.NEXT_PUBLIC_APP_URL, DEFAULT_APP_URL);

export function getSiteUrl() {
  return SITE_URL;
}

export function getAppUrl() {
  return APP_URL;
}

export type AppLoginIntent = "client" | "therapist";

export function buildAppLoginUrl(options?: {
  nextPath?: string;
  intent?: AppLoginIntent;
  entry?: string;
  surface?: "app" | "community";
}) {
  const surface = options?.surface || "app";
  // For community surface, go directly to backend auth start (cross-origin)
  if (surface === "community") {
    const url = new URL("/auth/google/start", API_BASE_URL);
    url.searchParams.set("intent", options?.intent || "client");
    url.searchParams.set("surface", "community");
    url.searchParams.set("return_to", options?.nextPath || "/");
    url.searchParams.set("entry", options?.entry || "public-content");
    return url.toString();
  }
  // For app surface, route through the app's login page
  const url = new URL("/auth/login", APP_URL);
  url.searchParams.set("next", options?.nextPath || "/chat");
  url.searchParams.set("intent", options?.intent || "client");
  url.searchParams.set("entry", options?.entry || "public-content");
  return url.toString();
}

export function buildClientLoginUrl(nextPath = "/chat") {
  return buildAppLoginUrl({
    nextPath,
    intent: "client",
  });
}

export function buildTherapistLoginUrl(nextPath = "/therapist/articles") {
  return buildAppLoginUrl({
    nextPath,
    intent: "therapist",
  });
}

export function buildAppTherapistConnectUrl(options: {
  therapistId: string;
  source?: "article" | "profile_direct_link" | "directory" | "referral" | "therapist_invite";
  sourceArticleSlug?: string;
  entryIntent?: "message" | "therapy";
  returnTo?: string;
  anonymousId?: string;
  sessionId?: string | null;
}) {
  const url = new URL("/connect/therapist", APP_URL);
  url.searchParams.set("therapist_id", options.therapistId);
  url.searchParams.set("source", options.source || "profile_direct_link");
  url.searchParams.set("entry_intent", options.entryIntent || "therapy");

  if (options.sourceArticleSlug) {
    url.searchParams.set("source_article_slug", options.sourceArticleSlug);
  }

  if (options.returnTo) {
    url.searchParams.set("return_to", options.returnTo);
  }

  if (options.anonymousId) {
    url.searchParams.set("anonymous_id", options.anonymousId);
  }

  if (options.sessionId) {
    url.searchParams.set("session_id", options.sessionId);
  }

  return url.toString();
}

export function buildPublicContentLoginUrl(options: {
  returnTo: string;
  anonymousId: string;
  sessionId?: string | null;
  intent?: AppLoginIntent;
}) {
  // Use full return URL so backend can redirect back to community directly
  const fullReturnTo = options.returnTo.startsWith("http")
    ? options.returnTo
    : `${SITE_URL}${options.returnTo.startsWith("/") ? options.returnTo : `/${options.returnTo}`}`;

  const url = new URL("/auth/google/start", API_BASE_URL);
  url.searchParams.set("intent", options.intent || "client");
  url.searchParams.set("surface", "community");
  url.searchParams.set("return_to", fullReturnTo);
  url.searchParams.set("entry", "public-content");
  if (options.anonymousId) {
    url.searchParams.set("anonymous_id", options.anonymousId);
  }
  if (options.sessionId) {
    url.searchParams.set("session_id", options.sessionId);
  }
  return url.toString();
}

export async function fetchApi<T>(
  path: string,
  options?: {
    revalidate?: number;
  }
): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: options?.revalidate ?? 300 }
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function postApi<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
