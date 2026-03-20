"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { APP_URL } from "../../lib/api";

export function PublicHeader() {
  const pathname = usePathname();
  const activePath =
    pathname?.startsWith("/therapists")
      ? "/therapists"
      : pathname?.startsWith("/bai-viet")
        ? "/bai-viet"
        : "/";

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
          <Link
            href="/therapists"
            className={activePath === "/therapists" ? "is-active" : undefined}
          >
            Nhà trị liệu
          </Link>
          <Link
            href="/bai-viet"
            className={activePath === "/bai-viet" ? "is-active" : undefined}
          >
            Bài viết
          </Link>
        </nav>

        <Link href={`${APP_URL}/auth/login`} className="button-secondary">
          Vào ứng dụng
        </Link>
      </div>
    </header>
  );
}
