import Link from "next/link";

import { APP_URL } from "../../lib/api";

export function LandingHero() {
  return (
    <section className="hero-grid">
      <div style={{ display: "grid", gap: 26 }}>
        <div className="eyebrow">Không gian đồng hành giữa các buổi</div>
        <h1 className="hero-title">
          Hiểu mình <span className="text-gradient">sâu hơn</span>, kết nối therapist rõ hơn.
        </h1>
        <p className="hero-copy">
          Miru kết hợp AI phản chiếu, tự đánh giá, bài tập và luồng kết nối therapist để hành trình chăm
          sóc tinh thần không còn bị đứt quãng giữa các buổi trị liệu.
        </p>
        <div className="button-row">
          <Link href={`${APP_URL}/auth/login`} className="button-primary">
            Bắt đầu với Miru
          </Link>
          <Link href="/bai-viet" className="button-secondary">
            Khám phá thư viện
          </Link>
        </div>
      </div>

      <div className="glass-card hero-visual">
        <div className="hero-frame">
          <div className="hero-orb hero-orb--one" />
          <div className="hero-orb hero-orb--two" />
          <div className="hero-panel">
            <div className="hero-note">
              <strong>Gợi ý từ Miru</strong>
              <div className="muted-copy">
                “Gần đây bạn đang gồng khá nhiều. Một bước nhỏ hôm nay cũng đã đủ để mở lại nhịp an toàn.”
              </div>
            </div>
            <div className="hero-card-stack">
              <div className="hero-stat">
                <div>
                  <div className="hero-stat__value">7 ngày</div>
                  <div className="muted-copy">lịch sử quỹ đạo được phản chiếu nhẹ nhàng, không chẩn đoán</div>
                </div>
              </div>
              <div className="hero-stat">
                <div>
                  <div className="hero-stat__value">1 chạm</div>
                  <div className="muted-copy">để therapist thấy tín hiệu quan trọng và follow-up đúng lúc</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
