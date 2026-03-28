export function LandingFeatureGrid() {
  return (
    <section className="page-gap">
      <div className="section-head" style={{ margin: "0 auto", textAlign: "center" }}>
        <div className="eyebrow" style={{ margin: "0 auto" }}>
          Vì sao là Miru
        </div>
        <h2 className="section-title">Một vòng đồng hành đủ gần để người dùng quay lại</h2>
        <p className="section-copy">
          Chúng mình không cố thay therapist. Miru giúp người dùng có điểm tựa nhẹ hằng ngày, còn therapist
          nhìn được tín hiệu rõ hơn giữa các buổi.
        </p>
      </div>

      <div className="feature-grid">
        <div className="surface-card feature-card">
          <div className="eyebrow">Hook cho thân chủ</div>
          <h3 className="section-title" style={{ fontSize: 34 }}>
            Chương hiện tại, self-test và những tín hiệu nhỏ được kể lại thành một câu chuyện.
          </h3>
          <p className="section-copy">
            Từ intake, nhật ký, thang đo và chat, Miru phản chiếu lại “gần đây bạn đang đi qua điều gì”
            thay vì chỉ trả lời từng tin nhắn rời rạc.
          </p>

          {/* Journey illustration */}
          <div style={{ marginTop: 28, borderRadius: 20, overflow: 'hidden', background: 'linear-gradient(135deg, #f3eeff 0%, #e8e0ff 50%, #f0e6ff 100%)', padding: '32px 24px' }}>
            <svg viewBox="0 0 440 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
              <path d="M40 130 C100 130, 100 50, 160 50 C220 50, 220 110, 280 110 C340 110, 340 60, 400 60" stroke="url(#grad1)" strokeWidth="3" strokeLinecap="round" fill="none" />
              <defs>
                <linearGradient id="grad1" x1="40" y1="90" x2="400" y2="90" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#c4b5fd" />
                  <stop offset="0.5" stopColor="#8b5cf6" />
                  <stop offset="1" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <circle cx="40" cy="130" r="12" fill="white" stroke="#c4b5fd" strokeWidth="2.5" />
              <circle cx="40" cy="130" r="5" fill="#8b5cf6" />
              <text x="40" y="158" textAnchor="middle" fill="#7c3aed" fontSize="10" fontWeight="600">Intake</text>
              <circle cx="160" cy="50" r="14" fill="white" stroke="#8b5cf6" strokeWidth="2.5" />
              <circle cx="160" cy="50" r="6" fill="#7c3aed" />
              <text x="160" y="78" textAnchor="middle" fill="#7c3aed" fontSize="10" fontWeight="600">Self-test</text>
              <circle cx="280" cy="110" r="12" fill="white" stroke="#a78bfa" strokeWidth="2.5" />
              <circle cx="280" cy="110" r="5" fill="#8b5cf6" />
              <text x="280" y="138" textAnchor="middle" fill="#7c3aed" fontSize="10" fontWeight="600">Nhật ký</text>
              <circle cx="400" cy="60" r="16" fill="#7c3aed" stroke="#6d28d9" strokeWidth="2" />
              <text x="400" y="64" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">CH</text>
              <text x="400" y="92" textAnchor="middle" fill="#7c3aed" fontSize="10" fontWeight="600">Chương</text>
              <circle cx="95" cy="85" r="6" fill="#c4b5fd" opacity="0.5" />
              <circle cx="220" cy="70" r="4" fill="#a78bfa" opacity="0.4" />
              <circle cx="340" cy="85" r="5" fill="#8b5cf6" opacity="0.35" />
              <circle cx="130" cy="110" r="3" fill="#ddd6fe" opacity="0.6" />
              <circle cx="310" cy="75" r="3.5" fill="#c4b5fd" opacity="0.5" />
            </svg>
          </div>
        </div>

        <div className="feature-split">
          <div className="surface-card feature-card feature-card--accent">
            <div className="eyebrow" style={{ background: "rgba(255,255,255,0.16)", color: "white" }}>
              Hook cho therapist
            </div>
            <h3 className="section-title" style={{ fontSize: 30, color: "white" }}>
              Morning board và follow-up giữa các buổi.
            </h3>
            <p className="section-copy">
              Therapist thấy ca nào cần chú ý hôm nay, vì sao và bước kế tiếp nên là gì.
            </p>
          </div>

          <div className="surface-card feature-card">
            <div className="eyebrow">Growth loop</div>
            <h3 className="section-title" style={{ fontSize: 30 }}>
              Hồ sơ therapist công khai và thư viện kiến thức có thể được tìm thấy.
            </h3>
            <p className="section-copy">
              Public profile, contact request và bài viết cho phép therapist vừa chia sẻ giá trị chuyên môn,
              vừa có thêm đầu vào thân chủ phù hợp.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
