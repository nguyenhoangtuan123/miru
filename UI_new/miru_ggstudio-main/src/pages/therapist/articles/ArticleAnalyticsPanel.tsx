import {
  BarChart3,
  Eye,
  MessageSquareQuote,
  MousePointerClick,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Article } from '../../../services/articles';
import { formatArticleDate } from '../../articles/articleUtils';
import {
  buildAnalyticsInsights,
  formatAnalyticsMetric,
  formatAnalyticsRate,
  type TherapistArticleAnalytics,
} from './articleAnalytics';

type ArticleAnalyticsPanelProps = {
  article: Article | null;
  analytics: TherapistArticleAnalytics | null;
  analyticsAvailable: boolean;
  loading?: boolean;
  error?: string | null;
};

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-white/55">{label}</div>
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-miru-primary/10 text-miru-primary">
          <Icon size={16} />
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold text-white">{value}</div>
      <div className="mt-2 text-xs leading-6 text-white/45">{hint}</div>
    </div>
  );
}

export function ArticleAnalyticsPanel({
  article,
  analytics,
  analyticsAvailable,
  loading = false,
  error,
}: ArticleAnalyticsPanelProps) {
  const insights = buildAnalyticsInsights(article ?? { status: 'draft' }, analytics);

  const hasMetrics = Boolean(analytics?.hasMeaningfulData);
  const shouldShowZeroState = !hasMetrics && !analyticsAvailable;

  return (
    <section className="glass-panel rounded-[30px] border border-white/10 p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/35">Analytics</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">Hiệu quả & nguồn chuyển đổi</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/60">
            Theo dõi bài nào đang kéo lượt đọc, bài nào dẫn người xem sang hồ sơ và bài nào đã bắt
            đầu tạo yêu cầu liên hệ hoặc pairing.
          </p>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
          {article?.published_at
            ? `Đăng công khai từ ${formatArticleDate(article.published_at)}`
            : 'Analytics sẽ rõ hơn sau khi bài được publish'}
        </div>
      </div>

      {!article ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm leading-7 text-white/55">
          Chọn một bài đã lưu để xem hiệu quả đọc bài, click sang hồ sơ, yêu cầu liên hệ và insight
          chuyển đổi của riêng bài đó.
        </div>
      ) : null}

      {article && error ? (
        <div className="mt-5 rounded-[24px] border border-amber-200/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      ) : null}

      {article && loading ? (
        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/55">
          Đang tải dữ liệu analytics...
        </div>
      ) : null}

      {article && shouldShowZeroState ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm leading-7 text-white/55">
          Backend analytics chi tiết chưa sẵn sàng hoặc bài này chưa có tín hiệu đọc/click đầu tiên.
          Khi public tracking được bật, Miru sẽ tự hiện lượt đọc, click sang hồ sơ, yêu cầu liên hệ
          và pairing ngay tại đây mà không lộ danh tính người đọc.
        </div>
      ) : null}

      {article && !loading && (analyticsAvailable || hasMetrics) ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Eye}
              label="Lượt đọc bài"
              value={formatAnalyticsMetric(analytics?.viewCount ?? 0)}
              hint={`${formatAnalyticsMetric(analytics?.engagedReadCount ?? 0)} lượt đọc sâu`}
            />
            <MetricCard
              icon={MousePointerClick}
              label="Click sang hồ sơ"
              value={formatAnalyticsMetric(analytics?.profileClickCount ?? 0)}
              hint={`${formatAnalyticsRate(analytics?.profileClickCount ?? 0, analytics?.viewCount ?? 0)} từ lượt đọc`}
            />
            <MetricCard
              icon={MessageSquareQuote}
              label="Yêu cầu liên hệ"
              value={formatAnalyticsMetric(analytics?.contactRequestCount ?? 0)}
              hint={`${formatAnalyticsRate(analytics?.contactRequestCount ?? 0, analytics?.profileClickCount ?? 0)} từ click hồ sơ`}
            />
            <MetricCard
              icon={Users}
              label="Pairing"
              value={formatAnalyticsMetric(analytics?.pairingCount ?? 0)}
              hint={`${formatAnalyticsRate(analytics?.pairingCount ?? 0, analytics?.contactRequestCount ?? 0)} từ yêu cầu liên hệ`}
            />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white/75">
                <BarChart3 size={16} />
                Attribution theo nguồn
              </div>
              <div className="mt-4 space-y-3">
                {analytics?.attributionSources?.length ? (
                  analytics.attributionSources.slice(0, 4).map((source) => (
                    <div key={source.source} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm text-white/65">
                        <span>{source.label}</span>
                        <span>{formatAnalyticsMetric(source.count)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-miru-primary to-sky-400"
                          style={{
                            width: `${Math.min(
                              100,
                              source.percentage ??
                                Math.round(
                                  ((source.count || 0) /
                                    Math.max(
                                      1,
                                      analytics.attributionSources[0]?.count ?? source.count ?? 1
                                    )) *
                                    100
                                )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm leading-7 text-white/50">
                    Chưa có nguồn nào đủ mạnh để xếp hạng. Miru sẽ hiện rõ khi bài bắt đầu có click
                    sang hồ sơ hoặc chuyển đổi sang contact request.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white/75">
                <Sparkles size={16} />
                Chủ đề kéo quan tâm
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {analytics?.topicTags?.length ? (
                  analytics.topicTags.slice(0, 6).map((topic) => (
                    <div
                      key={topic.tag}
                      className="rounded-full border border-miru-primary/25 bg-miru-primary/10 px-3 py-2 text-sm text-white/80"
                    >
                      {topic.label} · {formatAnalyticsMetric(topic.count)}
                    </div>
                  ))
                ) : (
                  <div className="text-sm leading-7 text-white/50">
                    Chưa có cụm chủ đề nổi bật. Khi người đọc đi sâu qua bài liên quan, tag và CTA,
                    Miru sẽ gom lại thành các tín hiệu topic ở đây.
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-3 rounded-[20px] border border-white/10 bg-black/10 p-4 text-sm text-white/65 sm:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/35">AI sessions</div>
                  <div className="mt-1 font-semibold text-white">
                    {formatAnalyticsMetric(analytics?.aiSessionCount ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/35">AI messages</div>
                  <div className="mt-1 font-semibold text-white">
                    {formatAnalyticsMetric(analytics?.aiMessageCount ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-white/35">Login uplift</div>
                  <div className="mt-1 font-semibold text-white">
                    {formatAnalyticsMetric(analytics?.loginPromptCount ?? 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {article ? (
        <div className="mt-5 rounded-[24px] border border-white/10 bg-black/10 p-4">
        <div className="text-xs uppercase tracking-[0.25em] text-white/35">Insight chuyển đổi</div>
        <ul className="mt-3 space-y-3 text-sm leading-7 text-white/70">
          {insights.map((insight) => (
            <li key={insight} className="flex gap-3">
              <span className="mt-2 h-2 w-2 rounded-full bg-miru-primary" />
              <span>{insight}</span>
            </li>
          ))}
        </ul>
        </div>
      ) : null}
    </section>
  );
}
