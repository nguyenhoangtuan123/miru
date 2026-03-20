import { API_BASE_URL } from "./api";

const ANONYMOUS_ID_KEY = "miru_public_anonymous_id";
const SESSION_ID_KEY = "miru_public_session_id";

export type PublicEventPayload = {
  event_type: string;
  article_slug?: string | null;
  therapist_id?: string | null;
  topic_tags?: string[];
  read_depth_percent?: number | null;
  referrer?: string | null;
  source_path?: string | null;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
};

type ViewerState = {
  anonymous_id: string;
  session_id: string;
  user_id: string | null;
  is_authenticated: boolean;
};

function safeWindow() {
  return typeof window === "undefined" ? null : window;
}

function createId(prefix: string) {
  const win = safeWindow();
  if (win?.crypto?.randomUUID) {
    return `${prefix}_${win.crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function readCookie(name: string) {
  const win = safeWindow();
  if (!win) {
    return null;
  }
  const parts = win.document.cookie.split(";").map((item) => item.trim());
  const match = parts.find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function getOrCreateAnonymousId() {
  const win = safeWindow();
  if (!win) {
    return "anonymous_server";
  }
  const existing = win.localStorage.getItem(ANONYMOUS_ID_KEY);
  if (existing) {
    return existing;
  }
  const next = createId("anon");
  win.localStorage.setItem(ANONYMOUS_ID_KEY, next);
  return next;
}

export function getOrCreateSessionId() {
  const win = safeWindow();
  if (!win) {
    return "session_server";
  }
  const existing = win.sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) {
    return existing;
  }
  const next = createId("session");
  win.sessionStorage.setItem(SESSION_ID_KEY, next);
  return next;
}

export function getViewerState(): ViewerState {
  const win = safeWindow();
  const anonymous_id = getOrCreateAnonymousId();
  const session_id = getOrCreateSessionId();
  const authUser = win ? win.localStorage.getItem("miru_public_user") : null;
  const cookieUser = readCookie("miru_public_user_id");
  const appUser = readCookie("miru_user_id");
  const user_id = authUser || cookieUser || appUser || null;

  return {
    anonymous_id,
    session_id,
    user_id,
    is_authenticated: Boolean(user_id),
  };
}

async function postJson(path: string, body: Record<string, unknown>) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      credentials: "include",
      keepalive: true,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function postPublicEvents(events: PublicEventPayload[]) {
  const viewer = getViewerState();
  const payload = {
    anonymous_id: viewer.anonymous_id,
    session_id: viewer.session_id,
    user_id: viewer.user_id,
    events: events.map((event) => ({
      ...event,
      occurred_at: event.occurred_at || new Date().toISOString(),
      referrer: event.referrer ?? (typeof document === "undefined" ? null : document.referrer || null),
      source_path: event.source_path ?? (typeof window === "undefined" ? null : window.location.pathname),
    })),
  };

  return postJson("/api/public/events/batch", payload);
}

export async function trackPublicEvent(event: PublicEventPayload) {
  return postPublicEvents([event]);
}

export async function aliasPublicIdentity(userId: string) {
  const viewer = getViewerState();
  return postJson("/api/public/identity/alias", {
    anonymous_id: viewer.anonymous_id,
    session_id: viewer.session_id,
    user_id: userId,
  });
}
