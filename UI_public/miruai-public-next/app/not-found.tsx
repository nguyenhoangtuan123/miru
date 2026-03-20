import Link from "next/link";

export default function NotFound() {
  return (
    <div className="surface-card empty-card">
      <h1 className="section-title" style={{ fontSize: 38, marginBottom: 14 }}>
        Trang này không còn ở đây nữa
      </h1>
      <p className="section-copy" style={{ marginBottom: 22 }}>
        Bạn có thể quay về trang chủ, mở thư viện bài viết hoặc xem danh bạ therapist công khai.
      </p>
      <div className="button-row" style={{ justifyContent: "center" }}>
        <Link href="/" className="button-primary">
          Về trang chủ
        </Link>
        <Link href="/bai-viet" className="button-secondary">
          Xem bài viết
        </Link>
      </div>
    </div>
  );
}
