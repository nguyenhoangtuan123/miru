const TOKEN_KEY = "miru_public_token";
const USER_KEY = "miru_public_user";

type PublicUser = {
    name: string;
    email: string;
};

/** Decode JWT payload without validation (client-side display only). */
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

/**
 * Call on page load: reads `miru_token` from URL, stores in localStorage,
 * then removes from URL bar (clean URL).
 */
export function captureTokenFromUrl(): boolean {
    if (typeof window === "undefined") return false;

    const url = new URL(window.location.href);
    const token = url.searchParams.get("miru_token");
    if (!token) return false;

    // Store token
    localStorage.setItem(TOKEN_KEY, token);

    // Extract user info from JWT
    const payload = decodeJwtPayload(token);
    if (payload) {
        const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
        const user: PublicUser = {
            name:
                String(payload.name || meta.name || payload.email || "").split("@")[0] || "User",
            email: String(payload.email || ""),
        };
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    // Clean URL — remove miru_token param
    url.searchParams.delete("miru_token");
    window.history.replaceState({}, "", url.toString());

    return true;
}

/** Get current auth state. Returns null if not logged in. */
export function getPublicAuthState(): { token: string; user: PublicUser } | null {
    if (typeof window === "undefined") return null;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    // Check if token is expired
    const payload = decodeJwtPayload(token);
    if (payload && typeof payload.exp === "number") {
        if (payload.exp * 1000 < Date.now()) {
            logoutPublic();
            return null;
        }
    }

    let user: PublicUser = { name: "User", email: "" };
    try {
        const stored = localStorage.getItem(USER_KEY);
        if (stored) {
            user = JSON.parse(stored) as PublicUser;
        }
    } catch {
        // ignore
    }

    return { token, user };
}

/** Get stored token for API calls. */
export function getPublicToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

/** Clear auth state. */
export function logoutPublic() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}
