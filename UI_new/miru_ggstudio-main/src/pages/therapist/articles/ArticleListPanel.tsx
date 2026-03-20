import { Plus, RefreshCw } from 'lucide-react';
import type { Article } from '../../../services/articles';
import { cleanArticleText, formatArticleDate, getArticleStatusMeta } from '../../articles/articleUtils';
import {
  findArticleAnalytics,
  formatAnalyticsMetric,
  type TherapistArticleAnalyticsIndex,
} from './articleAnalytics';

type ArticleListPanelProps = {
  articles: Article[];
  selectedArticleId: string | number | null;
  onSelect: (article: Article) => void;
  onCreateNew: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
  analyticsIndex: TherapistArticleAnalyticsIndex;
};

export function ArticleListPanel({
  articles,
  selectedArticleId,
  onSelect,
  onCreateNew,
  onRefresh,
  refreshing = false,
  analyticsIndex,
}: ArticleListPanelProps) {
  return (
    <section className="glass-panel rounded-[30px] border border-white/10 p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/35">Danh sách</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Bài viết của tôi</h2>
          <p className="mt-2 text-sm leading-7 text-white/60">
            Chọn một bài để tiếp tục chỉnh sửa, gửi duyệt hoặc lưu trữ.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : undefined} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 rounded-2xl bg-miru-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-miru-primary/85"
          >
            <Plus size={16} />
            Bài mới
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {articles.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/50">
            Chưa có bài viết nào. Tạo bản nháp đầu tiên để bắt đầu.
          </div>
        ) : (
          articles.map((article) => {
            const meta = getArticleStatusMeta(article.status);
            const isActive = String(selectedArticleId ?? '') === String(article.id ?? '');
            const analytics = findArticleAnalytics(article, analyticsIndex);
            const showAnalytics =
              analyticsIndex.endpointAvailable || Boolean(analytics?.hasMeaningfulData);

            return (
              <button
                key={String(article.id)}
                type="button"
                onClick={() => onSelect(article)}
                className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all ${
                  isActive
                    ? 'border-miru-primary/50 bg-miru-primary/10 shadow-[0_0_0_1px_rgba(129,28,217,0.15)]'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white">
                      {cleanArticleText(article.title, 'Bài viết chưa đặt tiêu đề')}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.25em] text-white/35">
                      /{cleanArticleText(article.slug, 'chua-co-slug')}
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/60">
                  {cleanArticleText(article.excerpt, 'Chưa có tóm tắt cho bài này.')}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/45">
                  <span>Đã sửa: {formatArticleDate(article.updated_at)}</span>
                  {article.published_at ? <span>Đăng: {formatArticleDate(article.published_at)}</span> : null}
                </div>

                {showAnalytics ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/65">
                      <div className="uppercase tracking-[0.2em] text-white/35">Đọc bài</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {formatAnalyticsMetric(analytics?.viewCount ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/65">
                      <div className="uppercase tracking-[0.2em] text-white/35">Click hồ sơ</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {formatAnalyticsMetric(analytics?.profileClickCount ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/65">
                      <div className="uppercase tracking-[0.2em] text-white/35">Liên hệ</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {formatAnalyticsMetric(analytics?.contactRequestCount ?? 0)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/65">
                      <div className="uppercase tracking-[0.2em] text-white/35">Pairing</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {formatAnalyticsMetric(analytics?.pairingCount ?? 0)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
