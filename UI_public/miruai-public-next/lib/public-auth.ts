import { API_BASE_URL } from "./api";

const TOKEN_KEY = "miru_public_token";
const PROFILE_KEY = "miru_public_profile";

// ── Types ──────────────────────────────────────────────
export type AuthStage = "anonymous" | "client" | "therapist";
export type AuthStatus = "anonymous" | "hydrating" | "authenticated";
export type TherapistStatus = "not_submitted" | "pending" | "approved" | "rejected";

export interface PublicAuthProfile {
    id: string;
    name: string;
    email: string;
    role: "client" | "therapist" | null;
    auth_stage: "client" | "therapist" | null;
    therapist_status: TherapistStatus | null;
    can_access_therapist_portal: boolean;
    is_admin_reviewer: boolean;
}

// ── JWT helpers ────────────────────────────────────────
function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(payload) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function isTokenExpired(token: string): boolean {
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now();
}

// ── Profile sync from backend ──────────────────────────
async function fetchProfileFromBackend(token: string): Promise<PublicAuthProfile | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/user/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            if (res.status === 401) {
                logoutPublic();
            }
            return null;
        }
        const data = await res.json();
        const u = data.user;
        if (!u) return null;

        const profile: PublicAuthProfile = {
            id: u.id || "",
            name: u.name || u.email?.split("@")[0] || "User",
            email: u.email || "",
            role: u.role || null,
            auth_stage: u.auth_stage || null,
            therapist_status: u.therapist_status || null,
            can_access_therapist_portal: u.can_access_therapist_portal ?? false,
            is_admin_reviewer: u.is_admin_reviewer ?? false,
        };

        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        return profile;
    } catch (err) {
        console.error("[public-auth] Failed to fetch profile:", err);
        return null;
    }
}

// ── Token capture ──────────────────────────────────────
/**
 * Call on page load: reads `miru_token` from URL, stores in localStorage,
 * fetches full profile from backend, then cleans URL.
 * Returns true if a token was captured.
 */
export function captureTokenFromUrl(): boolean {
    if (typeof window === "undefined") return false;

    const url = new URL(window.location.href);
    const token = url.searchParams.get("miru_token");
    if (!token) return false;

    // Store token
    localStorage.setItem(TOKEN_KEY, token);

    // Build a temporary profile from JWT until backend sync completes
    // auth_stage is null here — signals "hydrating" state
    const payload = decodeJwtPayload(token);
    if (payload) {
        const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
        const tempProfile: PublicAuthProfile = {
            id: String(payload.sub || ""),
            name: String(payload.name || meta.name || payload.email || "").split("@")[0] || "User",
            email: String(payload.email || ""),
            role: null,
            auth_stage: null,
            therapist_status: null,
            can_access_therapist_portal: false,
            is_admin_reviewer: false,
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(tempProfile));
    }

    // Clean URL
    url.searchParams.delete("miru_token");
    window.history.replaceState({}, "", url.toString());

    // Async: fetch real profile from backend (fire-and-forget)
    void fetchProfileFromBackend(token);

    return true;
}

/**
 * Sync profile from backend. Call this after page load to ensure
 * the profile is up-to-date (e.g., after role changes).
 */
export async function syncProfile(): Promise<PublicAuthProfile | null> {
    const token = getPublicToken();
    if (!token) return null;
    return fetchProfileFromBackend(token);
}

// ── Auth state getters ─────────────────────────────────

/** Get current auth profile. Returns null if not logged in or token expired. */
export function getPublicAuthState(): { token: string; profile: PublicAuthProfile } | null {
    if (typeof window === "undefined") return null;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    if (isTokenExpired(token)) {
        logoutPublic();
        return null;
    }

    let profile: PublicAuthProfile | null = null;
    try {
        const stored = localStorage.getItem(PROFILE_KEY);
        if (stored) {
            profile = JSON.parse(stored) as PublicAuthProfile;
        }
    } catch {
        // ignore
    }

    if (!profile) {
        // Fallback: minimal profile — auth_stage null indicates hydrating
        profile = {
            id: "", name: "User", email: "",
            role: null, auth_stage: null,
            therapist_status: null,
            can_access_therapist_portal: false,
            is_admin_reviewer: false,
        };
    }

    return { token, profile };
}

/**
 * Get the current auth status (anonymous, hydrating, or authenticated).
 * - anonymous: no token
 * - hydrating: have token but profile not yet synced from /api/user/me
 * - authenticated: profile fully synced
 */
export function getAuthStatus(): AuthStatus {
    if (typeof window === "undefined") return "anonymous";
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return "anonymous";

    if (isTokenExpired(token)) {
        logoutPublic();
        return "anonymous";
    }

    const stored = localStorage.getItem(PROFILE_KEY);
    if (!stored) return "hydrating";

    try {
        const profile = JSON.parse(stored) as PublicAuthProfile;
        // auth_stage is set by /api/user/me — null means we only have JWT data
        return profile.auth_stage ? "authenticated" : "hydrating";
    } catch {
        return "hydrating";
    }
}

/**
 * Get the current auth stage.
 * Only returns a real stage (client/therapist) when the profile has been
 * fully hydrated from /api/user/me. Otherwise returns "anonymous".
 */
export function getAuthStage(): AuthStage {
    const state = getPublicAuthState();
    if (!state) return "anonymous";

    // Only trust auth_stage from a hydrated profile
    if (state.profile.auth_stage === "therapist") return "therapist";
    if (state.profile.auth_stage === "client") return "client";

    // Profile not yet hydrated (auth_stage still null) → anonymous until sync
    return "anonymous";
}

/** Get stored token for API calls. */
export function getPublicToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

/** Clear all public auth state. */
export function logoutPublic() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PROFILE_KEY);
    // Legacy cleanup
    localStorage.removeItem("miru_public_user");
}
