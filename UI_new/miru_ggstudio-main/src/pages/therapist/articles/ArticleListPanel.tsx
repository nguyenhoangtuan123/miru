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

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium">
      <span className="mr-1 text-white/40">{label}</span>
      <span className="text-white/70">{value}</span>
    </div>
  );
}

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
    <section className="glass-panel rounded-[28px] border border-white/10 p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/35">
            Community library
          </div>
          <h2 className="mt-2 font-['Plus_Jakarta_Sans'] text-[28px] font-bold tracking-tight text-white">
            Bài viết của tôi
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-7 text-white/50">
            Chọn một bài để tiếp tục chỉnh sửa, xem tín hiệu community và xuất bản lên Miru Community.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : undefined} />
            Làm mới
          </button>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 rounded-full bg-miru-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(127,13,242,0.25)] transition hover:bg-miru-primary/85"
          >
            <Plus size={16} />
            Bài mới
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3 xl:max-h-[calc(100vh-16.5rem)] xl:overflow-y-auto xl:pr-1">
        {articles.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-10 text-center text-sm leading-7 text-white/50">
            Chưa có bài viết nào. Tạo bản nháp đầu tiên để bắt đầu studio của bạn.
          </div>
        ) : (
          articles.map((article) => {
            const meta = getArticleStatusMeta(article.status);
            const isActive = String(selectedArticleId ?? '') === String(article.id ?? '');
            const analytics = findArticleAnalytics(article, analyticsIndex);
            const showAnalytics = analyticsIndex.endpointAvailable || Boolean(analytics?.hasMeaningfulData);

            return (
              <button
                key={String(article.id)}
                type="button"
                onClick={() => onSelect(article)}
                className={`w-full rounded-[24px] p-4 text-left transition-all ${isActive
                    ? 'bg-miru-primary/15 ring-2 ring-miru-primary/40 shadow-[0_20px_55px_rgba(127,13,242,0.15)]'
                    : 'bg-white/5 ring-1 ring-white/10 hover:bg-white/8 hover:ring-white/15'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-['Plus_Jakarta_Sans'] text-lg font-semibold tracking-tight text-white">
                      {cleanArticleText(article.title, 'Bài viết chưa đặt tiêu đề')}
                    </div>
                    <div className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.25em] text-white/35">
                      /{cleanArticleText(article.slug, 'chua-co-slug')}
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-7 text-white/50">
                  {cleanArticleText(article.excerpt, 'Chưa có tóm tắt cho bài này.')}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/35">
                  <span>Đã sửa: {formatArticleDate(article.updated_at)}</span>
                  {article.published_at ? <span>Đăng: {formatArticleDate(article.published_at)}</span> : null}
                </div>

                {showAnalytics ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <MetricPill label="Đọc" value={formatAnalyticsMetric(analytics?.viewCount ?? 0)} />
                    <MetricPill
                      label="Hồ sơ"
                      value={formatAnalyticsMetric(analytics?.profileClickCount ?? 0)}
                    />
                    <MetricPill
                      label="Liên hệ"
                      value={formatAnalyticsMetric(analytics?.contactRequestCount ?? 0)}
                    />
                    <MetricPill
                      label="Pairing"
                      value={formatAnalyticsMetric(analytics?.pairingCount ?? 0)}
                    />
                    {Boolean((analytics?.questionCount ?? 0) || (analytics?.answeredQuestionCount ?? 0)) ? (
                      <MetricPill
                        label="Q&A"
                        value={`${formatAnalyticsMetric(analytics?.questionCount ?? 0)} / ${formatAnalyticsMetric(
                          analytics?.answeredQuestionCount ?? 0
                        )}`}
                      />
                    ) : null}
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
