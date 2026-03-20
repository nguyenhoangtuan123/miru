"use client";

import Link from "next/link";

import { estimateReadingMinutes, formatVietnameseDate } from "../../lib/format";
import type { PublicEventPayload } from "../../lib/public-events";
import type { PublicArticle } from "../../lib/types";
import { TrackedPublicLink } from "./TrackedPublicLink";

type ArticleCardProps = {
  article: PublicArticle;
  featured?: boolean;
  trackingEvent?: PublicEventPayload;
};

export function ArticleCard({ article, featured = false, trackingEvent }: ArticleCardProps) {
  const readingMinutes = estimateReadingMinutes(article);
  const cardClassName = featured
    ? "surface-card article-card article-card--featured"
    : "surface-card article-card";

  const content = featured ? (
    <>
      {article.cover_image_url ? (
        <div className="article-cover">
          <img src={article.cover_image_url} alt={article.title} />
        </div>
      ) : (
        <div className="article-cover--placeholder" aria-hidden="true" />
      )}

      <div className="article-card__body">
        <div className="chip-row">
          <span className="chip is-active">Tiêu điểm</span>
          {article.therapist_name ? <span className="chip">{article.therapist_name}</span> : null}
        </div>
        <h2 className="article-title">{article.title}</h2>
        <p className="article-excerpt">
          {article.excerpt || "Một góc nhìn thực tế, an toàn và giàu tính đồng hành cho hành trình chăm sóc sức khỏe tinh thần."}
        </p>
        <div className="article-meta">
          <span>{formatVietnameseDate(article.published_at || article.updated_at)}</span>
          <span>&bull;</span>
          <span>{readingMinutes} phút đọc</span>
        </div>
      </div>
    </>
  ) : (
    <>
      {article.cover_image_url ? (
        <div className="article-cover">
          <img src={article.cover_image_url} alt={article.title} />
        </div>
      ) : (
        <div className="article-cover--placeholder" aria-hidden="true" />
      )}

      <div>
        <div className="article-meta">
          {article.therapist_name ? <span>{article.therapist_name}</span> : null}
          <span>{formatVietnameseDate(article.published_at || article.updated_at)}</span>
        </div>
        <h3 className="article-title article-title--small" style={{ marginTop: 10 }}>
          {article.title}
        </h3>
        <p className="article-excerpt" style={{ marginTop: 10 }}>
          {article.excerpt || "Bài viết đang được cập nhật tóm tắt."}
        </p>
      </div>

      <div className="article-meta" style={{ marginTop: "auto" }}>
        <span>{readingMinutes} phút đọc</span>
        <span>&bull;</span>
        <span>Xem chi tiết</span>
      </div>
    </>
  );

  if (trackingEvent) {
    return (
      <TrackedPublicLink href={`/bai-viet/${article.slug}`} className={cardClassName} event={trackingEvent}>
        {content}
      </TrackedPublicLink>
    );
  }

  return (
    <Link href={`/bai-viet/${article.slug}`} className={cardClassName}>
      {content}
    </Link>
  );
}
