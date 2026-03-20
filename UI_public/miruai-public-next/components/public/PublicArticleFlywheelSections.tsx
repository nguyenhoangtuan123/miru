"use client";

import { useEffect, useState } from "react";

import {
  getRecommendedPublicArticles,
  getRecommendedPublicTherapists,
} from "../../lib/data";
import type { PublicArticle, PublicTherapist } from "../../lib/types";
import { ArticleCard } from "./ArticleCard";
import { TherapistRecommendationCard } from "./TherapistRecommendationCard";

type PublicArticleFlywheelSectionsProps = {
  articleSlug: string;
  topicTags: string[];
  initialRelatedArticles: PublicArticle[];
  initialRecommendedTherapists: PublicTherapist[];
};

export function PublicArticleFlywheelSections({
  articleSlug,
  topicTags,
  initialRelatedArticles,
  initialRecommendedTherapists,
}: PublicArticleFlywheelSectionsProps) {
  const [relatedArticles, setRelatedArticles] = useState(initialRelatedArticles);
  const [recommendedTherapists, setRecommendedTherapists] = useState(initialRecommendedTherapists);
  const [reasonTags, setReasonTags] = useState(topicTags);
  const [hasPersonalizedResults, setHasPersonalizedResults] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadRecommendations() {
      const [articlesResult, therapistsResult] = await Promise.all([
        getRecommendedPublicArticles(articleSlug),
        getRecommendedPublicTherapists(articleSlug),
      ]);

      if (cancelled) {
        return;
      }

      if (articlesResult.recommended_articles.length > 0) {
        setRelatedArticles(articlesResult.recommended_articles);
      }
      if (therapistsResult.recommended_therapists.length > 0) {
        setRecommendedTherapists(therapistsResult.recommended_therapists);
      }

      const nextReasonTags = [...articlesResult.reason_tags, ...therapistsResult.reason_tags].filter(
        (tag, index, array) => array.indexOf(tag) === index
      );
      if (nextReasonTags.length > 0) {
        setReasonTags(nextReasonTags);
      }

      setHasPersonalizedResults(
        articlesResult.recommended_articles.length > 0 ||
          therapistsResult.recommended_therapists.length > 0 ||
          nextReasonTags.length > 0
      );
    }

    void loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [articleSlug]);

  return (
    <>
      <section className="surface-card detail-section">
        <div className="eyebrow">
          {hasPersonalizedResults ? "Bài liên quan theo mạch đọc" : "Bài liên quan"}
        </div>
        {reasonTags.length > 0 ? (
          <div className="chip-row" style={{ marginTop: 14 }}>
            {reasonTags.slice(0, 4).map((tag) => (
              <span key={tag} className="chip is-active">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          {relatedArticles.map((relatedArticle) => (
            <ArticleCard
              key={relatedArticle.slug}
              article={relatedArticle}
              trackingEvent={{
                event_type: "related_article_click",
                article_slug: articleSlug,
                therapist_id: relatedArticle.therapist_id || null,
                topic_tags: topicTags,
                metadata: { target_article_slug: relatedArticle.slug },
              }}
            />
          ))}
        </div>
      </section>

      {recommendedTherapists.length > 0 ? (
        <section className="surface-card detail-section">
          <div className="section-head">
            <div className="eyebrow">Therapist phù hợp</div>
            <h2 className="section-title" style={{ fontSize: 32 }}>
              Gợi ý theo mạch đọc hiện tại
            </h2>
            <p className="section-copy">
              Miru đang gợi ý dựa trên chủ đề của bài viết và các tín hiệu hành vi gần đây, không phải kết luận lâm sàng.
            </p>
          </div>

          <div className="therapist-match-stack">
            {recommendedTherapists.map((recommendedTherapist) => (
              <TherapistRecommendationCard
                key={recommendedTherapist.therapist_id}
                therapist={recommendedTherapist}
                articleSlug={articleSlug}
                reasonTags={reasonTags}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
