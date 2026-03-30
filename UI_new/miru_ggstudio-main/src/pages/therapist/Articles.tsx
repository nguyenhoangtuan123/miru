import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Eye,
  FileText,
  MessageSquareQuote,
  MousePointerClick,
  PenSquare,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  archiveTherapistArticle,
  answerTherapistArticleQuestion,
  createTherapistArticle,
  getMyTherapistArticleQuestions,
  hideTherapistArticleQuestion,
  publishTherapistArticleQuestion,
  submitTherapistArticle,
  updateTherapistArticle,
  type Article,
  type ArticleForm,
  type ArticleQuestion,
  type ArticleQuestionStatus,
} from '../../services/articles';
import {
  queryKeys,
  myTherapistArticleAnalyticsQueryOptions,
  myTherapistArticlesQueryOptions,
} from '../../queries/appQueries';
import { PUBLIC_SITE_URL, buildPublicReturnBridgeUrl } from '../../services/api';
import { createArticleDraft, formatArticleDate, getArticleStatusMeta } from '../articles/articleUtils';
import { ArticleEditorPanel } from './articles/ArticleEditorPanel';
import { ArticleAnalyticsPanel } from './articles/ArticleAnalyticsPanel';
import { ArticleListPanel } from './articles/ArticleListPanel';
import { ArticleHistoryPanel } from './articles/ArticleHistoryPanel';
import { QuestionInboxPanel } from './articles/QuestionInboxPanel';
import {
  buildTherapistArticleAnalyticsIndex,
  findArticleAnalytics,
  formatAnalyticsMetric,
  summarizeTherapistArticleAnalytics,
} from './articles/articleAnalytics';

/* ── Helpers ──────────────────────────────────────────── */

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

/** Compare two ArticleForm objects to detect dirty state */
function areDraftsEqual(a: ArticleForm, b: ArticleForm): boolean {
  return (
    a.title === b.title &&
    a.slug === b.slug &&
    a.excerpt === b.excerpt &&
    a.cover_image_url === b.cover_image_url &&
    a.content_markdown === b.content_markdown &&
    a.seo_title === b.seo_title &&
    a.seo_description === b.seo_description
  );
}

type SaveStatus = 'unsaved' | 'saved' | 'dirty' | 'submitted';

function getSaveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case 'unsaved':
      return 'Chưa lưu';
    case 'saved':
      return 'Đã lưu nháp';
    case 'dirty':
      return 'Có thay đổi chưa lưu';
    case 'submitted':
      return 'Đã gửi duyệt';
  }
}

function getSaveStatusDotClass(status: SaveStatus): string {
  switch (status) {
    case 'unsaved':
    case 'dirty':
      return 'bg-amber-400';
    case 'saved':
      return 'bg-emerald-400';
    case 'submitted':
      return 'bg-miru-primary';
  }
}

/* ── Sub-components ──────────────────────────────────── */

function OverviewCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="glass-panel rounded-[24px] border border-white/10 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/40">{label}</div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-miru-primary/15 text-miru-primary">
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-4 font-['Plus_Jakarta_Sans'] text-4xl font-bold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-2 text-sm leading-7 text-white/50">{hint}</div>
    </div>
  );
}

function HeaderPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm backdrop-blur">
      <span className="mr-2 text-white/40">{label}</span>
      <span className="font-medium text-white/80">{value}</span>
    </div>
  );
}

function SaveStatusPill({ status }: { status: SaveStatus }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm backdrop-blur">
      <span className={`h-2 w-2 rounded-full ${getSaveStatusDotClass(status)}`} />
      <span className="font-medium text-white/80">{getSaveStatusLabel(status)}</span>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────── */

export function TherapistArticlesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const communityLibraryUrl = buildPublicReturnBridgeUrl(`${PUBLIC_SITE_URL}/bai-viet`);
  const articlesQuery = useQuery(myTherapistArticlesQueryOptions());
  const analyticsQuery = useQuery(myTherapistArticleAnalyticsQueryOptions());
  const [questionFilter, setQuestionFilter] = useState<ArticleQuestionStatus | 'all'>('all');
  const questionsQuery = useQuery({
    queryKey: ['articles', 'therapist', 'questions', questionFilter] as const,
    queryFn: () => getMyTherapistArticleQuestions(questionFilter),
    staleTime: 30 * 1000,
  });
  const articles = (articlesQuery.data?.articles ?? []) as Article[];
  const [selectedArticleId, setSelectedArticleId] = useState<string | number | null>(null);
  const [draft, setDraft] = useState<ArticleForm>(createArticleDraft());
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Dirty state tracking ──
  const savedSnapshotRef = useRef<ArticleForm>(createArticleDraft());
  const isDirty = !areDraftsEqual(draft, savedSnapshotRef.current);

  const selectedArticle = useMemo(
    () =>
      articles.find((article) => String(article.id) === String(selectedArticleId ?? '')) ?? null,
    [articles, selectedArticleId]
  );

  // Compute save status for the indicator pill
  const saveStatus: SaveStatus = useMemo(() => {
    if (selectedArticle?.status === 'pending_review' && !isDirty) return 'submitted';
    if (!selectedArticle && isCreatingNew) return 'unsaved';
    if (isDirty) return 'dirty';
    if (selectedArticle) return 'saved';
    return 'unsaved';
  }, [selectedArticle, isCreatingNew, isDirty]);

  // ── beforeunload warning ──
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Auto-select first article
  useEffect(() => {
    if (selectedArticleId !== null || isCreatingNew) {
      return;
    }
    const firstArticle = articles[0];
    if (firstArticle) {
      setSelectedArticleId(firstArticle.id);
      const newDraft = createArticleDraft(firstArticle);
      setDraft(newDraft);
      savedSnapshotRef.current = newDraft;
    }
  }, [articles, isCreatingNew, selectedArticleId]);

  // Sync draft when selected article changes (from list refresh, etc.)
  useEffect(() => {
    if (!selectedArticle) {
      return;
    }
    const newDraft = createArticleDraft(selectedArticle);
    setDraft(newDraft);
    savedSnapshotRef.current = newDraft;
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
  const questionItems = (questionsQuery.data?.questions ?? []) as ArticleQuestion[];
  const questionSummary = useMemo(
    () => ({
      total: questionItems.length,
      answered: questionItems.filter((question) =>
        ['answered', 'published'].includes(
          (question.answer_state ?? question.status ?? 'pending_review') as string
        )
      ).length,
    }),
    [questionItems]
  );
  const selectedAnalytics = useMemo(
    () => (selectedArticle ? findArticleAnalytics(selectedArticle, analyticsIndex) : null),
    [analyticsIndex, selectedArticle]
  );
  const selectedArticleUrl =
    selectedArticle?.slug && selectedArticle.status === 'published'
      ? buildPublicReturnBridgeUrl(`${PUBLIC_SITE_URL}/bai-viet/${selectedArticle.slug}`)
      : null;
  const hasArticles = articles.length > 0;
  const selectedStatusMeta = selectedArticle
    ? getArticleStatusMeta(selectedArticle.status)
    : getArticleStatusMeta('draft');
  const selectedTitle =
    selectedArticle?.title?.trim() || draft.title.trim() || 'Untitled article';

  function setDraftField<K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startNewArticle() {
    if (isDirty) {
      const confirmed = window.confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi và tạo bài mới?');
      if (!confirmed) return;
    }
    setSelectedArticleId(null);
    setIsCreatingNew(true);
    const newDraft = createArticleDraft();
    setDraft(newDraft);
    savedSnapshotRef.current = newDraft;
    setMessage(null);
    setError(null);
  }

  function handleSelectArticle(article: Article) {
    if (isDirty) {
      const confirmed = window.confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi và chuyển bài?');
      if (!confirmed) return;
    }
    setSelectedArticleId(article.id);
    setIsCreatingNew(false);
    setMessage(null);
    setError(null);
  }

  async function refreshArticles() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.articles.therapistMe() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.articles.therapistAnalytics() });
    await queryClient.invalidateQueries({ queryKey: ['articles', 'therapist', 'questions'] });
  }

  const answerQuestionMutation = useMutation({
    mutationFn: async ({ question, answerText }: { question: ArticleQuestion; answerText: string }) =>
      answerTherapistArticleQuestion(question.id, answerText),
    onSuccess: async () => {
      await refreshArticles();
      setMessage('Đã lưu trả lời cho câu hỏi cộng đồng.');
    },
    onError: (answerError) => {
      setError(answerError instanceof Error ? answerError.message : 'Không lưu được câu trả lời');
    },
  });

  const publishQuestionMutation = useMutation({
    mutationFn: async (question: ArticleQuestion) => publishTherapistArticleQuestion(question.id),
    onSuccess: async () => {
      await refreshArticles();
      setMessage('Đã đăng câu hỏi công khai.');
    },
    onError: (publishError) => {
      setError(publishError instanceof Error ? publishError.message : 'Không đăng công khai được câu hỏi');
    },
  });

  const hideQuestionMutation = useMutation({
    mutationFn: async (question: ArticleQuestion) => hideTherapistArticleQuestion(question.id),
    onSuccess: async () => {
      await refreshArticles();
      setMessage('Đã ẩn câu hỏi khỏi community.');
    },
    onError: (hideError) => {
      setError(hideError instanceof Error ? hideError.message : 'Không ẩn được câu hỏi');
    },
  });

  /**
   * Save current draft to backend.
   * @param options.silent — if true, skip success message
   * @returns the saved article id, or null on failure
   */
  const saveArticle = useCallback(
    async (options?: { silent?: boolean }): Promise<string | number | null> => {
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
          const newDraft = createArticleDraft(nextArticle);
          setDraft(newDraft);
          savedSnapshotRef.current = newDraft;
        } else {
          // Update snapshot to current draft even without returned article
          savedSnapshotRef.current = { ...draft };
        }

        if (!options?.silent) {
          setMessage(selectedArticle ? 'Đã lưu thay đổi cho bài viết.' : 'Đã tạo bản nháp mới.');
        }
        return nextArticle?.id ?? selectedArticle?.id ?? null;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Không lưu được bài viết');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [draft, selectedArticle, refreshArticles]
  );

  /**
   * Submit article for review.
   * Auto-saves first if the article is new or has unsaved changes.
   */
  async function submitReview() {
    try {
      setSubmitting(true);
      setMessage(null);
      setError(null);

      // Resolve the article id — auto-save if needed
      let articleId = selectedArticle?.id ?? null;

      if (!articleId || isDirty) {
        // Need to save first (new article or has unsaved edits)
        const savedId = await saveArticle({ silent: true });
        if (!savedId) {
          // Save failed — error already set by saveArticle
          return;
        }
        articleId = savedId;
      }

      // Now submit
      const response = await submitTherapistArticle(articleId);
      const nextArticle = response.article ?? null;
      await refreshArticles();

      if (nextArticle?.id !== undefined && nextArticle?.id !== null) {
        setSelectedArticleId(nextArticle.id);
        setIsCreatingNew(false);
        const newDraft = createArticleDraft(nextArticle);
        setDraft(newDraft);
        savedSnapshotRef.current = newDraft;
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
        const newDraft = createArticleDraft(nextArticle);
        setDraft(newDraft);
        savedSnapshotRef.current = newDraft;
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
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/35">
                <PenSquare size={14} />
                Community Studio
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-bold tracking-tight text-white md:text-[40px]">
                  Sanctuary Editor
                </h1>
                <div className="hidden h-5 w-px bg-white/15 md:block" />
                <span className="max-w-[28rem] truncate text-sm text-white/50">{selectedTitle}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <HeaderPill label="Trạng thái" value={selectedStatusMeta.label} />
                <SaveStatusPill status={saveStatus} />
                <HeaderPill label="Đăng nhập" value={user?.name || user?.email || 'Therapist'} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={communityLibraryUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 backdrop-blur transition hover:bg-white/10 hover:text-white"
              >
                <span>Mở Community</span>
                <ArrowUpRight size={16} />
              </a>

              {selectedArticleUrl ? (
                <a
                  href={selectedArticleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-miru-primary/30 bg-miru-primary/10 px-4 py-2 text-sm font-semibold text-miru-primary backdrop-blur transition hover:bg-miru-primary/20"
                >
                  <span>Xem bài đang live</span>
                  <ArrowUpRight size={16} />
                </a>
              ) : null}

              <button
                type="button"
                onClick={() => void saveArticle()}
                disabled={saving || !isDirty}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 backdrop-blur transition hover:bg-white/10 disabled:opacity-60"
              >
                {saving ? 'Đang lưu...' : 'Lưu nháp'}
              </button>

              <button
                type="button"
                onClick={() => void submitReview()}
                disabled={submitting || saving}
                className="rounded-full bg-miru-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(127,13,242,0.25)] transition hover:bg-miru-primary/85 disabled:opacity-60"
              >
                {submitting ? 'Đang gửi...' : 'Gửi duyệt'}
              </button>

              <button
                type="button"
                onClick={() => void archiveArticle()}
                disabled={archiving || !selectedArticle}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/10 disabled:opacity-60"
              >
                {archiving ? 'Đang lưu trữ...' : 'Lưu trữ'}
              </button>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {message ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-800 dark:text-emerald-200">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-5 py-4 text-sm text-amber-800 dark:text-amber-200">
              {error}
            </div>
          ) : null}

          {queryError ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-800 dark:text-rose-200">
              {queryError}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <OverviewCard
            icon={FileText}
            label="Tổng bài"
            value={stats.total}
            hint={`${stats.draft} nháp, ${stats.pending_review} chờ duyệt`}
          />
          <OverviewCard
            icon={Sparkles}
            label="Published"
            value={stats.published}
            hint={`${stats.rejected} bài cần chỉnh sửa thêm`}
          />
          <OverviewCard
            icon={Eye}
            label="Đọc sâu"
            value={analyticsAvailable ? formatAnalyticsMetric(analyticsSummary.totalEngagedReads) : '—'}
            hint="Số lượt đọc đủ dài để thành tín hiệu chất lượng"
          />
          <OverviewCard
            icon={MousePointerClick}
            label="Click hồ sơ"
            value={analyticsAvailable ? formatAnalyticsMetric(analyticsSummary.totalProfileClicks) : '—'}
            hint="Người đọc đi tiếp từ bài sang hồ sơ therapist"
          />
          <OverviewCard
            icon={MessageSquareQuote}
            label="Q&A"
            value={analyticsAvailable ? formatAnalyticsMetric(analyticsSummary.totalQuestions) : questionSummary.total}
            hint={`${questionSummary.answered} câu hỏi đã có phản hồi`}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
          <div className="space-y-4 xl:sticky xl:top-[7.2rem] xl:self-start">
            <ArticleListPanel
              articles={articles}
              analyticsIndex={analyticsIndex}
              selectedArticleId={selectedArticleId}
              onSelect={handleSelectArticle}
              onCreateNew={startNewArticle}
              onRefresh={() => void refreshArticles()}
              refreshing={articlesQuery.isFetching}
            />

            <div className="glass-panel rounded-[24px] border border-white/10 px-5 py-5 text-sm leading-7 text-white/50">
              <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">
                Studio note
              </div>
              <p className="mt-3">
                Khi bài đang ở trạng thái <strong className="text-white/80">chờ duyệt</strong> hoặc{' '}
                <strong className="text-white/80">đã đăng</strong>, việc lưu lại nội dung có thể đưa bài quay về{' '}
                <strong className="text-white/80">nháp</strong> nếu backend áp dụng quy tắc đó.
              </p>
            </div>

            <ArticleHistoryPanel
              articles={articles}
              onSelect={handleSelectArticle}
            />
          </div>

          <div className="min-w-0 space-y-4">
            <ArticleEditorPanel
              draft={draft}
              currentArticle={selectedArticle}
              onChange={setDraftField}
            />

            {!loading && !hasArticles ? (
              <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-10 text-center text-white/50">
                Chưa có bài viết nào trong portal. Bấm <strong className="text-white">Bài mới</strong> để bắt đầu.
              </div>
            ) : null}
          </div>

          <div className="space-y-4 xl:sticky xl:top-[7.2rem] xl:self-start">
            <ArticleAnalyticsPanel
              article={selectedArticle}
              draft={draft}
              onChange={setDraftField}
              analytics={selectedAnalytics}
              analyticsAvailable={analyticsAvailable}
              loading={analyticsQuery.isLoading && !analyticsQuery.data}
              error={analyticsError}
            />

            <QuestionInboxPanel
              questions={questionItems}
              filter={questionFilter}
              onFilterChange={(value) => setQuestionFilter(value)}
              onRefresh={() => void refreshArticles()}
              onAnswer={async (question, answerText) => {
                await answerQuestionMutation.mutateAsync({ question, answerText });
              }}
              onPublish={async (question) => {
                await publishQuestionMutation.mutateAsync(question);
              }}
              onHide={async (question) => {
                await hideQuestionMutation.mutateAsync(question);
              }}
              loading={questionsQuery.isLoading}
              error={questionsQuery.error instanceof Error ? questionsQuery.error.message : null}
              available={Boolean(questionsQuery.data?.available ?? questionsQuery.data?.questions?.length)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
