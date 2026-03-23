import Link from "next/link";

import { ArticleCard } from "../../components/public/ArticleCard";
import { filterByKeyword } from "../../lib/format";
import { getPublicArticles } from "../../lib/data";

type ArticleLibraryPageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

export const metadata = {
  title: "Thư viện bài viết",
};

export default async function ArticleLibraryPage({ searchParams }: ArticleLibraryPageProps) {
  const resolvedSearchParams = (await searchParams) || {};
  const keyword = resolvedSearchParams.q || "";
  const articles = await getPublicArticles({ limit: 24 });
  const filteredArticles = filterByKeyword(
    articles,
    keyword,
    (article) => `${article.title} ${article.excerpt || ""} ${article.therapist_name || ""}`,
  );
  const [featuredArticle, ...otherArticles] = filteredArticles;

  return (
    <div className="page-gap">
      <header className="section-head">
        <div className="eyebrow">Thư viện kiến thức</div>
        <h1 className="section-title">
          Những bài viết giúp người dùng hiểu mình rõ hơn trước khi cần đến một quyết định lớn.
        </h1>
        <p className="section-copy">
          Therapist có thể chia sẻ kiến thức công khai, còn người đọc có một điểm bắt đầu an toàn để bước vào
          hành trình chăm sóc tinh thần theo nhịp của riêng mình.
        </p>
      </header>

      <form className="search-shell" action="/bai-viet">
        <input
          className="search-input"
          type="search"
          name="q"
          defaultValue={keyword}
          placeholder="Tìm theo tiêu đề, tóm tắt hoặc tên therapist..."
        />
        <div className="chip-row">
          <Link href="/bai-viet" className={`chip ${keyword ? "" : "is-active"}`}>
            Tất cả
          </Link>
          <span className="chip">Mindfulness</span>
          <span className="chip">Mối quan hệ</span>
          <span className="chip">Tự chăm sóc</span>
          <span className="chip">Burnout</span>
        </div>
      </form>

      {featuredArticle ? (
        <div className="article-grid--library">
          <div className="library-featured">
            <ArticleCard article={featuredArticle} featured />
          </div>
          {otherArticles.map((article) => (
            <div key={article.slug} className="library-compact">
              <ArticleCard article={article} />
            </div>
          ))}
        </div>
      ) : (
        <div className="surface-card empty-card">
          Không tìm thấy bài viết phù hợp với từ khóa hiện tại. Bạn có thể thử lại với từ khóa ngắn hơn.
        </div>
      )}
    </div>
  );
}
