"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { APP_URL, buildAppLoginUrl, buildPublicContentLoginUrl, SITE_URL } from "../../lib/api";
import { captureTokenFromUrl, getPublicAuthState, logoutPublic } from "../../lib/public-auth";
import { getViewerState } from "../../lib/public-events";
import { TrackedPublicLink } from "./TrackedPublicLink";

export function PublicHeader() {
  const pathname = usePathname();
  const activePath =
    pathname?.startsWith("/therapists")
      ? "/therapists"
      : pathname?.startsWith("/bai-viet")
        ? "/bai-viet"
        : "/";

  const [authState, setAuthState] = useState<{ name: string } | null>(null);

  useEffect(() => {
    // Capture token from URL if returning from login
    captureTokenFromUrl();
    // Check stored auth
    const state = getPublicAuthState();
    if (state) {
      setAuthState({ name: state.user.name });
    }
  }, [pathname]);

  const currentPageUrl = `${SITE_URL}${pathname || "/"}`;

  const [clientLoginHref, setClientLoginHref] = useState(() =>
    buildAppLoginUrl({ nextPath: "/chat", intent: "client" }),
  );

  useEffect(() => {
    const viewer = getViewerState();
    setClientLoginHref(
      buildPublicContentLoginUrl({
        returnTo: currentPageUrl,
        anonymousId: viewer.anonymous_id,
        sessionId: viewer.session_id,
      }),
    );
  }, [currentPageUrl]);

  const handleLogout = useCallback(() => {
    logoutPublic();
    setAuthState(null);
  }, []);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand-mark">
          Miru
        </Link>

        <nav className="site-nav" aria-label="Điều hướng chính">
          <Link href="/" className={activePath === "/" ? "is-active" : undefined}>
            Trang chủ
          </Link>
          <Link href="/therapists" className={activePath === "/therapists" ? "is-active" : undefined}>
            Nhà trị liệu
          </Link>
          <Link href="/bai-viet" className={activePath === "/bai-viet" ? "is-active" : undefined}>
            Bài viết
          </Link>
        </nav>

        <div className="button-row">
          {authState ? (
            <>
              <span className="chip" style={{ fontWeight: 600 }}>
                👋 {authState.name}
              </span>
              <a href={`${APP_URL}/chat`} className="button-primary" style={{ textDecoration: "none" }}>
                Vào app
              </a>
              <button
                type="button"
                className="button-secondary"
                onClick={handleLogout}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <TrackedPublicLink
                href={clientLoginHref}
                className="button-primary"
                event={{
                  event_type: "article_to_app_login",
                  metadata: { source: "header", intent: "client" },
                }}
              >
                Đăng nhập / vào app
              </TrackedPublicLink>
              <TrackedPublicLink
                href={buildAppLoginUrl({ nextPath: "/therapist/articles", intent: "therapist" })}
                className="button-secondary"
                event={{
                  event_type: "article_to_app_login",
                  metadata: { source: "header", intent: "therapist" },
                }}
              >
                Viết bài cho Miru
              </TrackedPublicLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
