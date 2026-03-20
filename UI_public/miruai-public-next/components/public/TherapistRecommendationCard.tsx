"use client";

import { formatPrice, serviceModeLabel } from "../../lib/format";
import type { PublicTherapist } from "../../lib/types";
import { PublicLoginUpliftLink } from "./PublicLoginUpliftLink";
import { TrackedPublicLink } from "./TrackedPublicLink";

type TherapistRecommendationCardProps = {
  therapist: PublicTherapist;
  articleSlug: string;
  reasonTags: string[];
};

export function TherapistRecommendationCard({
  therapist,
  articleSlug,
  reasonTags,
}: TherapistRecommendationCardProps) {
  return (
    <div className="surface-card therapist-match-card">
      <div className="therapist-header">
        <div className="avatar-tile therapist-match-avatar" aria-hidden="true">
          {therapist.avatar_image?.url ? (
            <img src={therapist.avatar_image.url} alt={therapist.display_name} />
          ) : (
            therapist.display_name.charAt(0)
          )}
        </div>

        <div>
          <strong className="therapist-match-name">{therapist.display_name}</strong>
          {therapist.headline ? <div className="muted-copy therapist-match-headline">{therapist.headline}</div> : null}
        </div>
      </div>

      <div className="chip-row">
        <span className="chip">{serviceModeLabel(therapist.service_mode)}</span>
        <span className="chip">{formatPrice(therapist.starting_price_vnd, therapist.pricing_unit)}</span>
        {therapist.is_verified ? <span className="chip is-active">Đã xác minh</span> : null}
      </div>

      {reasonTags.length > 0 ? (
        <div className="therapist-match-reason">
          <strong>Miru đang gợi ý vì bài này chạm nhiều tới:</strong>
          <div className="chip-row">
            {reasonTags.slice(0, 3).map((tag) => (
              <span className="chip" key={`${therapist.therapist_id}-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="button-row therapist-match-actions">
        <TrackedPublicLink
          href={`/therapists/${therapist.therapist_id}`}
          className="button-primary"
          event={{
            event_type: "article_to_profile_click",
            article_slug: articleSlug,
            therapist_id: therapist.therapist_id,
            topic_tags: reasonTags,
            metadata: { source: "recommended_therapists" },
          }}
        >
          Xem hồ sơ
        </TrackedPublicLink>
        {therapist.can_receive_contact_requests ? (
          <PublicLoginUpliftLink
            returnTo={`/therapists/${encodeURIComponent(therapist.therapist_id)}?source=article&article=${encodeURIComponent(articleSlug)}`}
            className="button-secondary"
            event={{
              event_type: "article_to_contact_request",
              article_slug: articleSlug,
              therapist_id: therapist.therapist_id,
              topic_tags: reasonTags,
              metadata: { source: "recommended_therapists" },
            }}
          >
            Đăng nhập để liên hệ
          </PublicLoginUpliftLink>
        ) : (
          <div className="therapist-match-note">Therapist này hiện đang tạm đóng form liên hệ công khai.</div>
        )}
      </div>
    </div>
  );
}
