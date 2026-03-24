"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { buildPublicContentLoginUrl, SITE_URL } from "../../lib/api";
import { captureTokenFromUrl, logoutPublic, syncProfile } from "../../lib/public-auth";
import { getViewerState } from "../../lib/public-events";
import { computeStageCta, type StageCta } from "../../lib/stage-cta";
import { TrackedPublicLink } from "./TrackedPublicLink";

export function PublicHeader() {
  const pathname = usePathname();
  const activePath =
    pathname?.startsWith("/therapists")
      ? "/therapists"
      : pathname?.startsWith("/bai-viet")
        ? "/bai-viet"
        : pathname?.startsWith("/hoi-dap")
          ? "/hoi-dap"
          : "/";

  // Always start with anonymous CTA for SSR to avoid hydration mismatch
  const [cta, setCta] = useState<StageCta>(() => computeStageCta("anonymous"));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const captured = captureTokenFromUrl();
    if (captured) {
      syncProfile().then(() => {
        setCta(computeStageCta());
      });
    } else {
      setCta(computeStageCta());
    }
  }, [pathname]);

  // For anonymous stage, build a tracked login URL with viewer context
  const currentPageUrl = `${SITE_URL}${pathname || "/"}`;
  const [loginHref, setLoginHref] = useState(cta.primary.href);

  useEffect(() => {
    if (cta.stage === "anonymous") {
      const viewer = getViewerState();
      setLoginHref(
        buildPublicContentLoginUrl({
          returnTo: currentPageUrl,
          anonymousId: viewer.anonymous_id,
          sessionId: viewer.session_id,
        }),
      );
    }
  }, [currentPageUrl, cta.stage]);

  const handleLogout = useCallback(() => {
    logoutPublic();
    setCta(computeStageCta());
  }, []);

  const renderCtaButton = (btn: StageCta["primary"], isLogin = false) => {
    const className = btn.style === "primary" ? "button-primary" : "button-secondary";
    const href = isLogin ? loginHref : btn.href;

    if (btn.external) {
      return (
        <TrackedPublicLink
          href={href}
          className={className}
          event={{
            event_type: "header_cta_click",
            metadata: { label: btn.label, stage: cta.stage },
          }}
        >
          {btn.label}
        </TrackedPublicLink>
      );
    }

    return (
      <Link href={href} className={className}>
        {btn.label}
      </Link>
    );
  };

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
          <Link href="/hoi-dap" className={activePath === "/hoi-dap" ? "is-active" : undefined}>
            Câu hỏi
          </Link>
        </nav>

        <div className="button-row">
          {cta.greeting && (
            <span className="chip" style={{ fontWeight: 600 }}>
              {cta.greeting}
            </span>
          )}

          {renderCtaButton(cta.primary, cta.stage === "anonymous")}

          {cta.secondary && renderCtaButton(cta.secondary)}

          {cta.showLogout && (
            <button
              type="button"
              className="button-secondary"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
