import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleCard } from "../../../components/public/ArticleCard";
import { PublicLoginUpliftLink } from "../../../components/public/PublicLoginUpliftLink";
import { PublicPageTracker } from "../../../components/public/PublicPageTracker";
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

  return (
    <div className="page-gap">
      <PublicPageTracker
        initialEventType="therapist_profile_view"
        therapistId={therapist.therapist_id}
        topicTags={therapist.specializations}
      />

      <section className="surface-card detail-section">
        <div className="therapist-header" style={{ alignItems: "flex-start" }}>
          <div className="avatar-tile" aria-hidden="true" style={{ width: 96, height: 96, fontSize: 34 }}>
            {therapist.avatar_image?.url ? (
              <img src={therapist.avatar_image.url} alt={therapist.display_name} />
            ) : (
              therapist.display_name.charAt(0)
            )}
          </div>

          <div style={{ flex: 1, display: "grid", gap: 16 }}>
            <div>
              <div className="eyebrow">Hồ sơ therapist</div>
              <h1 className="detail-title" style={{ marginTop: 18 }}>
                {therapist.display_name}
              </h1>
              <p className="hero-copy" style={{ margin: "12px 0 0", maxWidth: 720 }}>
                {therapist.headline || therapist.bio || "Therapist đang hoàn thiện thêm hồ sơ công khai trên Miru."}
              </p>
            </div>

            <div className="chip-row">
              <span className="chip">{serviceModeLabel(therapist.service_mode)}</span>
              <span className="chip">{formatPrice(therapist.starting_price_vnd, therapist.pricing_unit)}</span>
              <span className="chip">
                {therapist.accepting_new_clients ? "Đang nhận thân chủ mới" : "Tạm chưa nhận thân chủ mới"}
              </span>
            </div>

            <div className="button-row">
              <PublicLoginUpliftLink
                returnTo={`/therapists/${encodeURIComponent(therapist.therapist_id)}?source=profile`}
                className="button-primary"
                event={{
                  event_type: "therapist_contact_request_started",
                  therapist_id: therapist.therapist_id,
                  topic_tags: therapist.specializations,
                  metadata: { source: "therapist_profile" },
                }}
              >
                Đăng nhập để liên hệ qua Miru
              </PublicLoginUpliftLink>
              <Link href="/bai-viet" className="button-secondary">
                Xem thêm bài viết
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <div className="surface-card metric-card">
          <div className="muted-copy">Lượt xem hồ sơ</div>
          <strong>{therapist.profile_view_count}</strong>
        </div>
        <div className="surface-card metric-card">
          <div className="muted-copy">Yêu cầu liên hệ</div>
          <strong>{therapist.contact_request_count}</strong>
        </div>
        <div className="surface-card metric-card">
          <div className="muted-copy">Tỷ lệ pair</div>
          <strong>{therapist.pair_conversion_count}</strong>
        </div>
      </section>

      <div className="detail-grid">
        <section className="surface-card detail-section">
          <div className="section-head">
            <div className="eyebrow">Giới thiệu</div>
            <h2 className="section-title" style={{ fontSize: 34 }}>
              Cách therapist này thường đồng hành
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
                <div key={`${index}-${step}`} className="surface-card" style={{ padding: 18 }}>
                  <strong style={{ color: "var(--primary)" }}>Bước {index + 1}</strong>
                  <div className="section-copy" style={{ marginTop: 8 }}>
                    {step}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <aside className="detail-sidebar">
          <section className="surface-card detail-section">
            <div className="eyebrow">Bài viết của therapist</div>
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
                  <Link key={item.therapist_id} href={`/therapists/${item.therapist_id}`} className="chip">
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
