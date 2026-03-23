import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleAiCompanion } from "../../../components/public/ArticleAiCompanion";
import { ArticleCommunityQuestions } from "../../../components/public/ArticleCommunityQuestions";
import { MarkdownArticle } from "../../../components/public/MarkdownArticle";
import { PublicArticleFlywheelSections } from "../../../components/public/PublicArticleFlywheelSections";
import { PublicPageTracker } from "../../../components/public/PublicPageTracker";
import { PublicTherapistActionLink } from "../../../components/public/PublicTherapistActionLink";
import { TrackedPublicLink } from "../../../components/public/TrackedPublicLink";
import { SITE_URL } from "../../../lib/api";
import {
  getPublicArticle,
  getPublicArticleQuestions,
  getPublicArticles,
  getPublicTherapist,
  getPublicTherapists,
} from "../../../lib/data";
import { estimateReadingMinutes, formatPrice, formatVietnameseDate, serviceModeLabel } from "../../../lib/format";
import { deriveArticleTopics, recommendRelatedArticles, recommendTherapistsByArticle } from "../../../lib/topic-intent";

type ArticleDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: ArticleDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicArticle(slug);
  if (!article) {
    return {
      title: "Không tìm thấy bài viết",
    };
  }

  return {
    title: article.seo_title || article.title,
    description: article.seo_description || article.excerpt || undefined,
    openGraph: {
      title: article.seo_title || article.title,
      description: article.seo_description || article.excerpt || undefined,
      url: `${SITE_URL}/bai-viet/${article.slug}`,
      type: "article",
    },
  };
}

export default async function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { slug } = await params;
  const article = await getPublicArticle(slug);

  if (!article) {
    notFound();
  }

  const [allArticles, therapist, allTherapists, initialQuestions] = await Promise.all([
    getPublicArticles({ limit: 12 }),
    article.therapist_id ? getPublicTherapist(article.therapist_id) : Promise.resolve(null),
    getPublicTherapists(12),
    getPublicArticleQuestions(article.slug, 8),
  ]);

  const readingMinutes = estimateReadingMinutes(article);
  const topicTags = deriveArticleTopics(article);
  const relatedArticles = recommendRelatedArticles(article, allArticles, 3);
  const recommendedTherapists = recommendTherapistsByArticle(article, allTherapists, 3);
  const articleUrl = `${SITE_URL}/bai-viet/${article.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.published_at || article.updated_at,
    dateModified: article.updated_at || article.published_at,
    author: {
      "@type": "Person",
      name: article.therapist_name || article.therapist?.display_name || "Therapist Miru",
    },
    publisher: {
      "@type": "Organization",
      name: "Miru",
    },
    mainEntityOfPage: `${SITE_URL}/bai-viet/${article.slug}`,
  };

  return (
    <div className="page-gap">
      <PublicPageTracker
        initialEventType="article_view"
        articleSlug={article.slug}
        therapistId={article.therapist_id || undefined}
        topicTags={topicTags}
        enableReadDepth
      />

      <article className="detail-grid">
        <section className="surface-card detail-section">
          <div className="chip-row">
            <span className="chip is-active">Bài viết therapist</span>
            {article.therapist_name ? <span className="chip">{article.therapist_name}</span> : null}
          </div>

          <h1 className="detail-title" style={{ marginTop: 20 }}>
            {article.title}
          </h1>

          <div className="article-meta" style={{ marginTop: 18 }}>
            <span>{formatVietnameseDate(article.published_at || article.updated_at)}</span>
            <span>&bull;</span>
            <span>{readingMinutes} phút đọc</span>
          </div>

          <div className="chip-row" style={{ marginTop: 18 }}>
            {topicTags.map((tag) => (
              <TrackedPublicLink
                key={tag}
                href={`/bai-viet?topic=${encodeURIComponent(tag)}`}
                className="chip"
                event={{
                  event_type: "article_tag_click",
                  article_slug: article.slug,
                  therapist_id: article.therapist_id || null,
                  topic_tags: topicTags,
                  metadata: { tag },
                }}
              >
                {tag}
              </TrackedPublicLink>
            ))}
          </div>

          <div style={{ marginTop: 28 }}>
            {article.cover_image_url ? (
              <div className="article-cover">
                <img src={article.cover_image_url} alt={article.title} />
              </div>
            ) : (
              <div className="article-cover--placeholder" style={{ minHeight: 340 }} aria-hidden="true" />
            )}
          </div>

          <div style={{ marginTop: 30 }}>
            <MarkdownArticle
              markdown={
                article.content_markdown ||
                "Nội dung bài viết đang được cập nhật thêm. Bạn có thể quay lại thư viện để xem các bài viết khác trong khi chờ bản đầy đủ."
              }
            />
          </div>

          <div style={{ marginTop: 30 }}>
            <ArticleCommunityQuestions
              articleSlug={article.slug}
              articleTitle={article.title}
              topicTags={topicTags}
              initialQuestions={initialQuestions}
              therapistId={article.therapist_id || therapist?.therapist_id || undefined}
            />
          </div>
        </section>

        <aside className="detail-sidebar">
          <section className="surface-card detail-section">
            <div className="eyebrow">Tác giả</div>
            <h2 className="section-title" style={{ fontSize: 32 }}>
              {article.therapist_name || therapist?.display_name || "Therapist Miru"}
            </h2>
            <p className="section-copy">
              {therapist?.headline ||
                article.therapist?.headline ||
                "Một therapist đang chia sẻ góc nhìn chuyên môn thông qua thư viện Miru."}
            </p>

            {therapist ? (
              <>
                <div className="chip-row" style={{ marginTop: 16 }}>
                  <span className="chip">{serviceModeLabel(therapist.service_mode)}</span>
                  <span className="chip">{formatPrice(therapist.starting_price_vnd, therapist.pricing_unit)}</span>
                </div>

                <div className="button-row" style={{ marginTop: 18 }}>
                  <TrackedPublicLink
                    href={`/therapists/${therapist.therapist_id}`}
                    className="button-primary"
                    event={{
                      event_type: "article_to_profile_click",
                      article_slug: article.slug,
                      therapist_id: therapist.therapist_id,
                      topic_tags: topicTags,
                      metadata: { source: "author_card" },
                    }}
                  >
                    Xem hồ sơ therapist
                  </TrackedPublicLink>

                  {therapist.can_receive_contact_requests ? (
                    <>
                      <PublicTherapistActionLink
                        therapistId={therapist.therapist_id}
                        source="article"
                        sourceArticleSlug={article.slug}
                        entryIntent="message"
                        returnTo={articleUrl}
                        className="button-secondary"
                        event={{
                          event_type: "article_to_contact_request",
                          article_slug: article.slug,
                          therapist_id: therapist.therapist_id,
                          topic_tags: topicTags,
                          metadata: { source: "author_card", entry_intent: "message" },
                        }}
                      >
                        Nhắn riêng therapist
                      </PublicTherapistActionLink>

                      <PublicTherapistActionLink
                        therapistId={therapist.therapist_id}
                        source="article"
                        sourceArticleSlug={article.slug}
                        entryIntent="therapy"
                        returnTo={articleUrl}
                        className="button-secondary"
                        event={{
                          event_type: "article_to_contact_request",
                          article_slug: article.slug,
                          therapist_id: therapist.therapist_id,
                          topic_tags: topicTags,
                          metadata: { source: "author_card", entry_intent: "therapy" },
                        }}
                      >
                        Đăng ký trị liệu
                      </PublicTherapistActionLink>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </section>

          <ArticleAiCompanion article={article} topicTags={topicTags} />

          <PublicArticleFlywheelSections
            articleSlug={article.slug}
            topicTags={topicTags}
            initialRelatedArticles={relatedArticles}
            initialRecommendedTherapists={recommendedTherapists}
          />
        </aside>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </div>
  );
}
