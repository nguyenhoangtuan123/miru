import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleCard } from "../../../components/public/ArticleCard";
import { PublicPageTracker } from "../../../components/public/PublicPageTracker";
import { PublicTherapistActionLink } from "../../../components/public/PublicTherapistActionLink";
import { SITE_URL } from "../../../lib/api";
import { getPublicArticles, getPublicTherapist, getPublicTherapists } from "../../../lib/data";
import { formatPrice, serviceModeLabel } from "../../../lib/format";

type TherapistDetailPageProps = {
  params: Promise<{
    therapistId: string;
  }>;
};

export async function generateMetadata({ params }: TherapistDetailPageProps): Promise<Metadata> {
  const { therapistId } = await params;
  const therapist = await getPublicTherapist(therapistId);
  if (!therapist) {
    return { title: "Không tìm thấy therapist" };
  }
  return {
    title: therapist.display_name,
    description: therapist.headline || therapist.bio || undefined,
    openGraph: {
      title: therapist.display_name,
      description: therapist.headline || therapist.bio || undefined,
      url: `${SITE_URL}/therapists/${therapist.therapist_id}`,
    },
  };
}

export default async function TherapistDetailPage({ params }: TherapistDetailPageProps) {
  const { therapistId } = await params;
  const therapist = await getPublicTherapist(therapistId);
  if (!therapist) {
    notFound();
  }

  const [articles, otherTherapists] = await Promise.all([
    getPublicArticles({ limit: 6, therapistId }),
    getPublicTherapists(6),
  ]);
  const relatedTherapists = otherTherapists
    .filter((item) => item.therapist_id !== therapist.therapist_id)
    .slice(0, 3);
  const profileUrl = `${SITE_URL}/therapists/${therapist.therapist_id}`;
  const metricCards = [
    { label: "Lượt xem hồ sơ", value: therapist.profile_view_count },
    { label: "Yêu cầu liên hệ", value: therapist.contact_request_count },
    { label: "Tỷ lệ pair", value: therapist.pair_conversion_count },
  ];

  return (
    <div className="page-gap">
      <PublicPageTracker
        initialEventType="therapist_profile_view"
        therapistId={therapist.therapist_id}
        topicTags={therapist.specializations}
      />

      <section className="surface-card detail-section" style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gap: 28,
            alignItems: "center",
            gridTemplateColumns: "minmax(0, 260px) minmax(0, 1fr)",
          }}
        >
          <div
            style={{
              position: "relative",
              minHeight: 280,
              borderRadius: 32,
              overflow: "hidden",
              background:
                "linear-gradient(145deg, rgba(129, 28, 217, 0.18), rgba(193, 133, 255, 0.08))",
            }}
          >
            {therapist.avatar_image?.url ? (
              <img
                src={therapist.avatar_image.url}
                alt={therapist.display_name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 72,
                  fontWeight: 800,
                  color: "var(--primary)",
                }}
              >
                {therapist.display_name.charAt(0)}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 18 }}>
            <div className="eyebrow">Miru Community Profile</div>
            <div>
              <h1 className="detail-title" style={{ marginTop: 0 }}>
                {therapist.display_name}
              </h1>
              <p className="hero-copy" style={{ margin: "14px 0 0", maxWidth: 720 }}>
                {therapist.headline ||
                  therapist.bio ||
                  "Therapist đang hoàn thiện thêm hồ sơ công khai trên Miru Community."}
              </p>
            </div>

            <div className="chip-row">
              <span className="chip">{serviceModeLabel(therapist.service_mode)}</span>
              <span className="chip">
                {formatPrice(therapist.starting_price_vnd, therapist.pricing_unit)}
              </span>
              <span className="chip">
                {therapist.accepting_new_clients ? "Đang nhận thân chủ mới" : "Tạm chưa nhận ca mới"}
              </span>
              {therapist.is_verified ? <span className="chip is-active">Đã xác minh</span> : null}
            </div>

            <div className="button-row">
              {therapist.can_receive_contact_requests ? (
                <>
                  <PublicTherapistActionLink
                    therapistId={therapist.therapist_id}
                    source="profile_direct_link"
                    entryIntent="message"
                    returnTo={profileUrl}
                    className="button-primary"
                    event={{
                      event_type: "therapist_contact_request_started",
                      therapist_id: therapist.therapist_id,
                      topic_tags: therapist.specializations,
                      metadata: { source: "therapist_profile", entry_intent: "message" },
                    }}
                  >
                    Nhắn riêng therapist
                  </PublicTherapistActionLink>

                  <PublicTherapistActionLink
                    therapistId={therapist.therapist_id}
                    source="profile_direct_link"
                    entryIntent="therapy"
                    returnTo={profileUrl}
                    className="button-secondary"
                    event={{
                      event_type: "therapist_contact_request_started",
                      therapist_id: therapist.therapist_id,
                      topic_tags: therapist.specializations,
                      metadata: { source: "therapist_profile", entry_intent: "therapy" },
                    }}
                  >
                    Đăng ký trị liệu
                  </PublicTherapistActionLink>
                </>
              ) : (
                <div className="chip">Therapist này hiện đang tạm đóng form kết nối công khai.</div>
              )}
            </div>

            <div className="metric-grid" style={{ marginTop: 6 }}>
              {metricCards.map((item) => (
                <div className="surface-card metric-card" key={item.label}>
                  <div className="muted-copy">{item.label}</div>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="detail-grid">
        <section className="surface-card detail-section">
          <div className="section-head">
            <div className="eyebrow">Philosophy of care</div>
            <h2 className="section-title" style={{ fontSize: 34 }}>
              Cách therapist này thường đồng hành cùng thân chủ
            </h2>
          </div>

          <p className="section-copy" style={{ marginTop: 18 }}>
            {therapist.bio || "Hồ sơ therapist đang được cập nhật thêm."}
          </p>

          {therapist.specializations.length > 0 ? (
            <div className="chip-row" style={{ marginTop: 18 }}>
              {therapist.specializations.map((item) => (
                <span className="chip" key={item}>
                  {item}
                </span>
              ))}
            </div>
          ) : null}

          {therapist.public_workflow_steps.length > 0 ? (
            <div style={{ display: "grid", gap: 14, marginTop: 28 }}>
              {therapist.public_workflow_steps.map((step, index) => (
                <div
                  key={`${index}-${step}`}
                  className="surface-card"
                  style={{ padding: 18, display: "grid", gap: 8 }}
                >
                  <strong style={{ color: "var(--primary)" }}>Bước {index + 1}</strong>
                  <div className="section-copy">{step}</div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="detail-sidebar">
          <section className="surface-card detail-section">
            <div className="section-head">
              <div className="eyebrow">Insights & Research</div>
              <h2 className="section-title" style={{ fontSize: 28 }}>
                Bài viết của therapist
              </h2>
            </div>

            <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
              {articles.length > 0 ? (
                articles.map((article) => <ArticleCard key={article.slug} article={article} />)
              ) : (
                <div className="empty-card" style={{ padding: "18px 0" }}>
                  Chưa có bài viết công khai nào từ therapist này.
                </div>
              )}
            </div>
          </section>

          {relatedTherapists.length > 0 ? (
            <section className="surface-card detail-section">
              <div className="eyebrow">Khám phá thêm</div>
              <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
                {relatedTherapists.map((item) => (
                  <Link
                    key={item.therapist_id}
                    href={`/therapists/${item.therapist_id}`}
                    className="chip"
                  >
                    {item.display_name}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
