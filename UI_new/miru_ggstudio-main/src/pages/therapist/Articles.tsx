import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  FileText,
  MousePointerClick,
  PenSquare,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  archiveTherapistArticle,
  createTherapistArticle,
  submitTherapistArticle,
  updateTherapistArticle,
  type Article,
  type ArticleForm,
} from '../../services/articles';
import {
  queryKeys,
  myTherapistArticleAnalyticsQueryOptions,
  myTherapistArticlesQueryOptions,
} from '../../queries/appQueries';
import { ArticleEditorPanel } from './articles/ArticleEditorPanel';
import { ArticleAnalyticsPanel } from './articles/ArticleAnalyticsPanel';
import { ArticleListPanel } from './articles/ArticleListPanel';
import { createArticleDraft } from '../articles/articleUtils';
import {
  buildTherapistArticleAnalyticsIndex,
  findArticleAnalytics,
  formatAnalyticsMetric,
  summarizeTherapistArticleAnalytics,
} from './articles/articleAnalytics';

const emptyDraft = createArticleDraft();

function buildStats(articles: Article[]) {
  const stats = {
    total: articles.length,
    draft: 0,
    pending_review: 0,
    published: 0,
    rejected: 0,
    archived: 0,
  };

  for (const article of articles) {
    const key = (article.status || 'draft') as keyof typeof stats;
    if (key in stats) {
      stats[key] += 1;
    }
  }

  return stats;
}

function ArticleSummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="glass-panel rounded-[24px] border border-white/10 p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-miru-primary/10 text-miru-primary">
        <Icon size={18} />
      </div>
      <div className="text-sm text-white/50">{label}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
      {hint ? <div className="mt-2 text-xs leading-6 text-white/40">{hint}</div> : null}
    </div>
  );
}

export function TherapistArticlesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const articlesQuery = useQuery(myTherapistArticlesQueryOptions());
  const analyticsQuery = useQuery(myTherapistArticleAnalyticsQueryOptions());
  const articles = (articlesQuery.data?.articles ?? []) as Article[];
  const [selectedArticleId, setSelectedArticleId] = useState<string | number | null>(null);
  const [draft, setDraft] = useState<ArticleForm>(emptyDraft);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedArticle = useMemo(
    () =>
      articles.find((article) => String(article.id) === String(selectedArticleId ?? '')) ?? null,
    [articles, selectedArticleId]
  );

  useEffect(() => {
    if (selectedArticleId !== null || isCreatingNew) {
      return;
    }
    const firstArticle = articles[0];
    if (firstArticle) {
      setSelectedArticleId(firstArticle.id);
      setDraft(createArticleDraft(firstArticle));
    }
  }, [articles, isCreatingNew, selectedArticleId]);

  useEffect(() => {
    if (!selectedArticle) {
      return;
    }
    setDraft(createArticleDraft(selectedArticle));
  }, [selectedArticle]);

  const stats = useMemo(() => buildStats(articles), [articles]);
  const analyticsIndex = useMemo(
    () => buildTherapistArticleAnalyticsIndex(articles, analyticsQuery.data),
    [articles, analyticsQuery.data]
  );
  const analyticsSummary = useMemo(
    () => summarizeTherapistArticleAnalytics(articles, analyticsIndex),
    [articles, analyticsIndex]
  );
  const selectedAnalytics = useMemo(
    () => (selectedArticle ? findArticleAnalytics(selectedArticle, analyticsIndex) : null),
    [analyticsIndex, selectedArticle]
  );
  const hasArticles = articles.length > 0;

  function setDraftField<K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startNewArticle() {
    setSelectedArticleId(null);
    setIsCreatingNew(true);
    setDraft(emptyDraft);
    setMessage(null);
    setError(null);
  }

  async function refreshArticles() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.articles.therapistMe() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.articles.therapistAnalytics() });
  }

  async function saveArticle() {
    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      const payload = {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        cover_image_url: draft.cover_image_url,
        content_markdown: draft.content_markdown,
        seo_title: draft.seo_title,
        seo_description: draft.seo_description,
      };

      const response = selectedArticle?.id
        ? await updateTherapistArticle(selectedArticle.id, payload)
        : await createTherapistArticle(payload);

      const nextArticle = response.article ?? null;
      await refreshArticles();

      if (nextArticle?.id !== undefined && nextArticle?.id !== null) {
        setSelectedArticleId(nextArticle.id);
        setIsCreatingNew(false);
        setDraft(createArticleDraft(nextArticle));
      }

      setMessage(
        selectedArticle
          ? 'Đã lưu thay đổi cho bài viết.'
          : 'Đã tạo bản nháp mới.'
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được bài viết');
    } finally {
      setSaving(false);
    }
  }

  async function submitReview() {
    if (!selectedArticle?.id) {
      setError('Bạn cần lưu bài trước khi gửi duyệt.');
      return;
    }
    try {
      setSubmitting(true);
      setMessage(null);
      setError(null);
      const response = await submitTherapistArticle(selectedArticle.id);
      const nextArticle = response.article ?? null;
      await refreshArticles();
      if (nextArticle?.id !== undefined && nextArticle?.id !== null) {
        setSelectedArticleId(nextArticle.id);
        setIsCreatingNew(false);
        setDraft(createArticleDraft(nextArticle));
      }
      setMessage('Đã gửi bài sang hàng chờ duyệt.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không gửi duyệt được bài');
    } finally {
      setSubmitting(false);
    }
  }

  async function archiveArticle() {
    if (!selectedArticle?.id) {
      setError('Chọn một bài viết trước khi lưu trữ.');
      return;
    }
    try {
      setArchiving(true);
      setMessage(null);
      setError(null);
      const response = await archiveTherapistArticle(selectedArticle.id);
      const nextArticle = response.article ?? null;
      await refreshArticles();
      if (nextArticle?.id !== undefined && nextArticle?.id !== null) {
        setSelectedArticleId(nextArticle.id);
        setIsCreatingNew(false);
        setDraft(createArticleDraft(nextArticle));
      }
      setMessage('Đã lưu trữ bài viết.');
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Không lưu trữ được bài viết');
    } finally {
      setArchiving(false);
    }
  }

  const loading = articlesQuery.isLoading;
  const queryError = articlesQuery.error instanceof Error ? articlesQuery.error.message : null;
  const analyticsError =
    analyticsQuery.error instanceof Error ? analyticsQuery.error.message : null;
  const analyticsAvailable = Boolean(analyticsQuery.data?.available || analyticsIndex.hasAnyMetrics);

  return (
    <div className="min-h-screen bg-miru-bg px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/35">
                <PenSquare size={14} />
                Therapist content
              </div>
              <h1 className="mt-3 text-3xl font-bold md:text-4xl">Bài viết chia sẻ kiến thức</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                Quản lý bài viết ở một nơi: tạo nháp, chỉnh sửa nội dung, theo dõi trạng thái duyệt
                và lưu trữ khi cần.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              Đang đăng nhập: {user?.name || user?.email}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <ArticleSummaryCard icon={FileText} label="Tổng bài" value={stats.total} />
            <ArticleSummaryCard icon={Sparkles} label="Nháp" value={stats.draft} />
            <ArticleSummaryCard icon={Sparkles} label="Chờ duyệt" value={stats.pending_review} />
            <ArticleSummaryCard icon={Sparkles} label="Đã đăng" value={stats.published} />
            <ArticleSummaryCard icon={Sparkles} label="Từ chối" value={stats.rejected} />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.3em] text-white/35">Hiệu quả nội dung</div>
            <div className="text-xs text-white/45">
              Chỉ hiện số tổng hợp. Không lộ danh tính người đọc.
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ArticleSummaryCard
              icon={Eye}
              label="Lượt đọc"
              value={analyticsAvailable ? formatAnalyticsMetric(analyticsSummary.totalViews) : '—'}
              hint={`${formatAnalyticsMetric(analyticsSummary.totalEngagedReads)} lượt đọc sâu`}
            />
            <ArticleSummaryCard
              icon={MousePointerClick}
              label="Click sang hồ sơ"
              value={
                analyticsAvailable ? formatAnalyticsMetric(analyticsSummary.totalProfileClicks) : '—'
              }
              hint="Đo mức quan tâm sau khi đọc bài"
            />
            <ArticleSummaryCard
              icon={Sparkles}
              label="Yêu cầu liên hệ"
              value={
                analyticsAvailable
                  ? formatAnalyticsMetric(analyticsSummary.totalContactRequests)
                  : '—'
              }
              hint="Lead phát sinh trực tiếp từ nội dung"
            />
            <ArticleSummaryCard
              icon={Users}
              label="Pairing"
              value={
                analyticsAvailable ? formatAnalyticsMetric(analyticsSummary.totalPairings) : '—'
              }
              hint={`${analyticsSummary.publishedTrackedCount} bài published đã có tín hiệu`}
            />
          </div>
        </section>

        {message && (
          <div className="rounded-[24px] border border-emerald-200/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-[24px] border border-amber-200/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        )}

        {queryError && (
          <div className="rounded-[24px] border border-red-200/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {queryError}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <ArticleListPanel
              articles={articles}
              analyticsIndex={analyticsIndex}
              selectedArticleId={selectedArticleId}
              onSelect={(article) => {
                setSelectedArticleId(article.id);
                setIsCreatingNew(false);
                setMessage(null);
                setError(null);
              }}
              onCreateNew={startNewArticle}
              onRefresh={() => void refreshArticles()}
              refreshing={articlesQuery.isFetching}
            />

            <div className="glass-panel rounded-[28px] border border-white/10 p-5 text-sm leading-7 text-white/60">
              <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/35">Lưu ý</div>
              Khi bài đang ở trạng thái <strong>chờ duyệt</strong> hoặc <strong>đã đăng</strong>, việc
              lưu lại nội dung có thể đưa bài quay về <strong>nháp</strong> nếu backend áp dụng quy tắc
              đó. Hãy gửi duyệt lại sau khi chỉnh xong.
            </div>
          </div>

          <div className="space-y-6">
            <ArticleEditorPanel
              draft={draft}
              currentArticle={selectedArticle}
              onChange={setDraftField}
              onSave={() => void saveArticle()}
              onSubmitReview={() => void submitReview()}
              onArchive={() => void archiveArticle()}
              saving={saving}
              submitting={submitting}
              archiving={archiving}
            />

            <ArticleAnalyticsPanel
              article={selectedArticle}
              analytics={selectedAnalytics}
              analyticsAvailable={analyticsAvailable}
              loading={analyticsQuery.isLoading && !analyticsQuery.data}
              error={analyticsError}
            />
          </div>
        </section>

        {!loading && !hasArticles && (
          <div className="glass-panel rounded-[28px] border border-white/10 px-6 py-12 text-center text-white/55">
            Chưa có bài viết nào trong portal. Bấm <strong>Bài mới</strong> để bắt đầu.
          </div>
        )}
      </div>
    </div>
  );
}
