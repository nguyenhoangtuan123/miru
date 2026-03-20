const DEFAULT_API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8008"
    : "https://web-production-56fc05.up.railway.app";
const DEFAULT_SITE_URL = "https://miruai.vercel.app";
const DEFAULT_APP_URL = "https://app.miruai.vercel.app";

function normalizeUrl(value: string | undefined, fallback: string) {
  return (value || fallback).replace(/\/+$/, "");
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

export function buildClientLoginUrl(nextPath = "/chat") {
  const url = new URL("/auth/login", APP_URL);
  url.searchParams.set("next", nextPath);
  url.searchParams.set("intent", "client");
  url.searchParams.set("entry", "public-content");
  return url.toString();
}

export function buildPublicContentLoginUrl(options: {
  returnTo: string;
  anonymousId: string;
  sessionId?: string | null;
}) {
  const bridgeUrl = new URL("/public-return", APP_URL);
  bridgeUrl.searchParams.set("return_to", options.returnTo);
  bridgeUrl.searchParams.set("anonymous_id", options.anonymousId);
  if (options.sessionId) {
    bridgeUrl.searchParams.set("session_id", options.sessionId);
  }
  return buildClientLoginUrl(`${bridgeUrl.pathname}${bridgeUrl.search}`);
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
