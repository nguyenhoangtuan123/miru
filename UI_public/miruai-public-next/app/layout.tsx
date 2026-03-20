import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";
import { SITE_URL } from "../lib/api";
import { PublicFooter } from "../components/public/PublicFooter";
import { PublicHeader } from "../components/public/PublicHeader";

const headlineFont = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-headline"
});

const bodyFont = Manrope({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Miru | Đồng hành sức khoẻ tinh thần giữa các buổi trị liệu",
    template: "%s | Miru"
  },
  description:
    "Landing page công khai của Miru: khám phá therapist, bài viết chia sẻ kiến thức và cách Miru đồng hành cùng thân chủ giữa các buổi trị liệu.",
  openGraph: {
    title: "Miru",
    description:
      "Khám phá therapist, thư viện kiến thức và cách Miru hỗ trợ continuity of care giữa các buổi trị liệu.",
    url: SITE_URL,
    siteName: "Miru",
    locale: "vi_VN",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${headlineFont.variable} ${bodyFont.variable}`}>
        <PublicHeader />
        <main className="page-stack">
          <div className="site-shell">{children}</div>
        </main>
        <PublicFooter />
      </body>
    </html>
  );
}
