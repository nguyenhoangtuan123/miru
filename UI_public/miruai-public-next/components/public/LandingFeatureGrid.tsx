export function LandingFeatureGrid() {
  return (
    <section className="page-gap">
      <div className="section-head" style={{ margin: "0 auto", textAlign: "center" }}>
        <div className="eyebrow" style={{ margin: "0 auto" }}>
          Vì sao là Miru
        </div>
        <h2 className="section-title">Một vòng đồng hành đủ gần để người dùng quay lại</h2>
        <p className="section-copy">
          Chúng mình không cố thay therapist. Miru giúp người dùng có điểm tựa nhẹ hàng ngày, còn therapist
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
