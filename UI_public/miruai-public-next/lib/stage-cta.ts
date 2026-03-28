/**
 * Stage-aware CTA helper.
 * Computes CTA buttons based on auth stage for consistent rendering
 * across PublicHeader, LandingHero, article surfaces, etc.
 */

import { APP_URL, buildAppLoginUrl } from "./api";
import { getPublicAuthState, getAuthStatus, type AuthStage, type PublicAuthProfile } from "./public-auth";

export interface CtaButton {
    label: string;
    href: string;
    style: "primary" | "secondary";
    /** If true, link is external (use <a> not <Link>) */
    external: boolean;
}

export interface StageCta {
    stage: AuthStage;
    profile: PublicAuthProfile | null;
    primary: CtaButton;
    secondary: CtaButton | null;
    /** User greeting if logged in */
    greeting: string | null;
    /** Show logout button */
    showLogout: boolean;
}

export function computeStageCta(forceStage?: AuthStage): StageCta {
    const authState = forceStage === "anonymous" ? null : getPublicAuthState();
    const status = forceStage === "anonymous" ? "anonymous" : getAuthStatus();

    // ── Anonymous or Hydrating ────────────────────────────
    // While hydrating, show anonymous CTAs — they'll update on next render
    if (!authState || status === "anonymous" || status === "hydrating") {
        return {
            stage: "anonymous",
            profile: null,
            primary: {
                label: "Đăng nhập / vào app",
                href: buildAppLoginUrl({ nextPath: "/chat", intent: "client" }),
                style: "primary",
                external: true,
            },
            secondary: {
                label: "Viết bài cho Miru",
                href: buildAppLoginUrl({ nextPath: "/therapist/articles", intent: "therapist" }),
                style: "secondary",
                external: true,
            },
            greeting: null,
            showLogout: false,
        };
    }

    const { profile } = authState;

    // ── Therapist ───────────────────────────────────────
    if (profile.auth_stage === "therapist") {
        if (profile.can_access_therapist_portal) {
            return {
                stage: "therapist",
                profile,
                primary: {
                    label: "Viết bài",
                    href: `${APP_URL}/therapist/articles`,
                    style: "primary",
                    external: true,
                },
                secondary: {
                    label: "Chỉnh sửa hồ sơ",
                    href: `${APP_URL}/therapist/profile`,
                    style: "secondary",
                    external: true,
                },
                greeting: `👋 ${profile.name}`,
                showLogout: true,
            };
        }

        if (profile.therapist_status === "pending") {
            return {
                stage: "therapist",
                profile,
                primary: {
                    label: "Xem trạng thái duyệt",
                    href: `${APP_URL}/therapist/review-status`,
                    style: "primary",
                    external: true,
                },
                secondary: null,
                greeting: `👋 ${profile.name}`,
                showLogout: true,
            };
        }

        // not_submitted or rejected
        return {
            stage: "therapist",
            profile,
            primary: {
                label: "Hoàn tất hồ sơ therapist",
                href: `${APP_URL}/therapist/apply`,
                style: "primary",
                external: true,
            },
            secondary: {
                label: "Vào app",
                href: `${APP_URL}`,
                style: "secondary",
                external: true,
            },
            greeting: `👋 ${profile.name}`,
            showLogout: true,
        };
    }

    // ── Client (default for authenticated users) ────────
    return {
        stage: "client",
        profile,
        primary: {
            label: "Vào app",
            href: `${APP_URL}/chat`,
            style: "primary",
            external: true,
        },
        secondary: {
            label: "Đặt câu hỏi lên web",
            href: "/hoi-dap",
            style: "secondary",
            external: false,
        },
        greeting: `👋 ${profile.name}`,
        showLogout: true,
    };
}
