"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildPublicContentLoginUrl, SITE_URL } from "../../lib/api";
import { getPublicAuthState, syncProfile } from "../../lib/public-auth";
import { getViewerState } from "../../lib/public-events";
import { computeStageCta, type StageCta } from "../../lib/stage-cta";
import { TrackedPublicLink } from "./TrackedPublicLink";

export function LandingHero() {
  const [cta, setCta] = useState<StageCta>(() => computeStageCta());

  useEffect(() => {
    // Re-sync profile on mount to ensure fresh data
    const authState = getPublicAuthState();
    if (authState) {
      syncProfile().then(() => setCta(computeStageCta()));
    }
  }, []);

  // For anonymous: build tracked login URL
  const [loginHref, setLoginHref] = useState(cta.primary.href);
  useEffect(() => {
    if (cta.stage === "anonymous") {
      const viewer = getViewerState();
      setLoginHref(
        buildPublicContentLoginUrl({
          returnTo: `${SITE_URL}/`,
          anonymousId: viewer.anonymous_id,
          sessionId: viewer.session_id,
        }),
      );
    }
  }, [cta.stage]);

  const renderButton = (btn: StageCta["primary"], isLogin = false) => {
    const className = btn.style === "primary" ? "button-primary" : "button-secondary";
    const href = isLogin ? loginHref : btn.href;

    if (btn.external) {
      return (
        <TrackedPublicLink
          href={href}
          className={className}
          event={{
            event_type: "landing_hero_cta_click",
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
    <section className="hero-grid">
      <div style={{ display: "grid", gap: 26 }}>
        <div className="eyebrow">Không gian đồng hành giữa các buổi</div>
        <h1 className="hero-title">
          Hiểu mình <span className="text-gradient">sâu hơn</span>, kết nối therapist rõ hơn.
        </h1>
        <p className="hero-copy">
          Miru Community là nơi therapist chia sẻ bài viết, người đọc hỏi AI và đặt câu hỏi công khai.
          Miru App là lớp riêng tư để cá nhân hóa sâu hơn, theo dõi tiến trình và giữ nhịp đồng hành.
        </p>
        <div className="button-row">
          {renderButton(cta.primary, cta.stage === "anonymous")}
          {cta.secondary && renderButton(cta.secondary)}
        </div>
      </div>

      <div className="glass-card hero-visual">
        <div className="hero-frame">
          <div className="hero-orb hero-orb--one" />
          <div className="hero-orb hero-orb--two" />
          <div className="hero-panel">
            <div className="hero-note">
              <strong>Một lớp community mềm và rõ</strong>
              <div className="muted-copy">
                Bài viết, AI companion, câu hỏi công khai và hồ sơ therapist tạo thành cửa vào nhẹ hơn cho người mới.
              </div>
            </div>
            <div className="hero-card-stack">
              <div className="hero-stat">
                <div>
                  <div className="hero-stat__value">Community</div>
                  <div className="muted-copy">Đọc, hỏi, khám phá và tìm therapist phù hợp</div>
                </div>
              </div>
              <div className="hero-stat">
                <div>
                  <div className="hero-stat__value">App</div>
                  <div className="muted-copy">Cá nhân hóa, trajectory, bài tập và follow-up riêng tư</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
