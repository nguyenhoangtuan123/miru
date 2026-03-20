import Link from "next/link";

import { APP_URL } from "../../lib/api";

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <div className="brand-mark" style={{ fontSize: 22 }}>
            Miru
          </div>
          <div style={{ marginTop: 8 }}>
            Không gian công khai để khám phá therapist, bài viết và bước đầu đồng hành.
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <Link href="/therapists">Danh bạ therapist</Link>
          <Link href="/bai-viet">Thư viện kiến thức</Link>
          <Link href={`${APP_URL}/auth/login`}>Đăng nhập ứng dụng</Link>
        </div>
      </div>
    </footer>
  );
}
