"use client";

import { useEffect, useState } from "react";
import { APP_URL, buildAppLoginUrl } from "../../lib/api";
import { getPublicAuthState } from "../../lib/public-auth";
import { TrackedPublicLink } from "./TrackedPublicLink";

export function LandingHero() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!getPublicAuthState());
  }, []);

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
          {isLoggedIn ? (
            <a href={`${APP_URL}/chat`} className="button-primary" style={{ textDecoration: "none" }}>
              Vào app
            </a>
          ) : (
            <>
              <TrackedPublicLink
                href={buildAppLoginUrl({ nextPath: "/chat", intent: "client" })}
                className="button-primary"
                event={{
                  event_type: "article_to_app_login",
                  metadata: { source: "landing_hero", intent: "client" },
                }}
              >
                Đăng nhập / vào app
              </TrackedPublicLink>
              <TrackedPublicLink
                href={buildAppLoginUrl({ nextPath: "/therapist/articles", intent: "therapist" })}
                className="button-secondary"
                event={{
                  event_type: "article_to_app_login",
                  metadata: { source: "landing_hero", intent: "therapist" },
                }}
              >
                Tôi là therapist
              </TrackedPublicLink>
            </>
          )}
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
