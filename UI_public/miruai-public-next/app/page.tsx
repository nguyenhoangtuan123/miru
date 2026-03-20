import Link from "next/link";

import { ArticleCard } from "../components/public/ArticleCard";
import { LandingCompanion } from "../components/public/LandingCompanion";
import { LandingFeatureGrid } from "../components/public/LandingFeatureGrid";
import { LandingHero } from "../components/public/LandingHero";
import { TherapistCard } from "../components/public/TherapistCard";
import { getPublicArticles, getPublicTherapists } from "../lib/data";

export default async function HomePage() {
  const [articles, therapists] = await Promise.all([
    getPublicArticles({ limit: 3 }),
    getPublicTherapists(3)
  ]);

  const [featuredArticle, ...otherArticles] = articles;

  return (
    <div className="page-gap">
      <LandingHero />
      <LandingFeatureGrid />

      <section className="page-gap">
        <div className="section-head">
          <div className="eyebrow">Kiến thức từ therapist</div>
          <h2 className="section-title">Thư viện bài viết để người dùng có lý do quay lại ngay từ lần đầu.</h2>
          <p className="section-copy">
            Nội dung công khai giúp Miru có cửa vào nhẹ nhàng hơn: người dùng học được điều gì đó hữu ích trước,
            rồi mới quyết định có muốn bước sâu hơn vào ứng dụng hay không.
          </p>
        </div>

        {featuredArticle ? (
          <div className="article-showcase">
            <ArticleCard article={featuredArticle} featured />
            <div style={{ display: "grid", gap: 22 }}>
              {otherArticles.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </div>
          </div>
        ) : (
          <div className="surface-card empty-card">Chưa có bài viết công khai nào để hiển thị.</div>
        )}

        <div className="button-row">
          <Link href="/bai-viet" className="button-primary">
            Mở thư viện kiến thức
          </Link>
          <Link href="/therapists" className="button-secondary">
            Xem therapist phù hợp
          </Link>
        </div>
      </section>

      <section className="page-gap">
        <div className="section-head">
          <div className="eyebrow">Danh bạ therapist</div>
          <h2 className="section-title">Hồ sơ công khai rõ ràng hơn để người dùng ra quyết định nhanh hơn.</h2>
          <p className="section-copy">
            Từ cách làm việc, giá khởi điểm đến khả năng nhận thân chủ mới, Miru giúp therapist giới thiệu mình
            theo ngôn ngữ sáng, gọn và dễ chuyển đổi hơn.
          </p>
        </div>

        <div className="therapist-grid">
          {therapists.map((therapist) => (
            <TherapistCard key={therapist.therapist_id} therapist={therapist} />
          ))}
        </div>
      </section>

      <LandingCompanion />
    </div>
  );
}
