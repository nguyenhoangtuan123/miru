import Link from "next/link";

import { APP_URL } from "../../lib/api";

export function LandingCompanion() {
  return (
    <section className="surface-card conversation-panel">
      <div className="section-head">
        <div className="eyebrow">Giọng điệu của Miru</div>
        <h2 className="section-title">Một cuộc trò chuyện có thể thay đổi ngày của bạn.</h2>
        <p className="section-copy">
          Miru không nói thay chuyên gia. Nó tạo một không gian dịu, có nhịp, để người dùng cảm thấy có
          thể mở lời ngay thay vì phải chờ đến lúc quá tải.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div className="conversation-bubble conversation-bubble--ai">
          Chào bạn. Hôm nay nhịp bên trong bạn đang thế nào? Nếu muốn, mình có thể cùng bạn đi chậm lại một
          chút và gọi tên điều đang nặng nhất.
        </div>
        <div className="conversation-bubble conversation-bubble--user">
          Mình hơi áp lực vì công việc kéo dài nhiều ngày rồi, nhưng lại chưa biết nên bắt đầu gỡ từ đâu.
        </div>
        <div className="conversation-bubble conversation-bubble--ai">
          Vậy mình bắt đầu từ điều gần nhất nhé: có phải bạn đang mệt vì phải gồng liên tục và không có đủ
          khoảng nghỉ thật sự?
        </div>
      </div>

      <div className="button-row">
        <Link href={`${APP_URL}/chat`} className="button-primary">
          Mở chat trong ứng dụng
        </Link>
        <Link href="/therapists" className="button-secondary">
          Xem therapist phù hợp
        </Link>
      </div>
    </section>
  );
}
