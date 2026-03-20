import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleX, FileText, ShieldCheck } from 'lucide-react';
import { approveAdminArticle, rejectAdminArticle, type Article } from '../../services/articles';
import { adminArticleReviewQueryOptions, queryKeys } from '../../queries/appQueries';
import { cleanArticleText, formatArticleDate, getArticleStatusMeta } from '../articles/articleUtils';

function AdminStatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
}) {
  return (
    <div className="glass-panel rounded-[24px] border border-white/10 p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-miru-primary/10 text-miru-primary">
        <Icon size={18} />
      </div>
      <div className="text-sm text-white/50">{label}</div>
      <div className="mt-2 text-3xl font-bold text-white">{value}</div>
    </div>
  );
}

export function AdminArticlesPage() {
  const queryClient = useQueryClient();
  const articlesQuery = useQuery(adminArticleReviewQueryOptions());
  const articles = (articlesQuery.data?.articles ?? []) as Article[];
  const [selectedArticleId, setSelectedArticleId] = useState<string | number | null>(null);
  const [rejectionReason, setRejectionReason] = useState(
    'Bài cần bổ sung rõ hơn về ngữ cảnh thực hành, nguồn tham khảo hoặc lời khuyến nghị an toàn cho người đọc.'
  );
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedArticle = useMemo(
    () =>
      articles.find((article) => String(article.id) === String(selectedArticleId ?? '')) ?? null,
    [articles, selectedArticleId]
  );

  useEffect(() => {
    if (selectedArticleId !== null) {
      return;
    }
    const firstPending = articles.find((article) => article.status === 'pending_review') ?? articles[0];
    if (firstPending) {
      setSelectedArticleId(firstPending.id);
    }
  }, [articles, selectedArticleId]);

  useEffect(() => {
    if (!selectedArticle?.rejection_reason) {
      return;
    }
    setRejectionReason(selectedArticle.rejection_reason);
  }, [selectedArticle]);

  const pendingArticles = articles.filter((article) => article.status === 'pending_review');
  const reviewStats = useMemo(
    () => ({
      total: articles.length,
      pending: pendingArticles.length,
      published: articles.filter((article) => article.status === 'published').length,
      rejected: articles.filter((article) => article.status === 'rejected').length,
    }),
    [articles, pendingArticles.length]
  );

  async function refreshArticles() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.articles.adminReview() });
  }

  async function handleApprove(article: Article) {
    try {
      setBusyId(article.id);
      setError(null);
      setMessage(null);
      const response = await approveAdminArticle(article.id);
      const nextArticle = response.article ?? null;
      await refreshArticles();
      if (nextArticle?.id !== undefined && nextArticle?.id !== null) {
        setSelectedArticleId(nextArticle.id);
      }
      setMessage('Đã duyệt và chuyển bài sang trạng thái công khai.');
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Không duyệt được bài viết');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(article: Article) {
    try {
      setBusyId(article.id);
      setError(null);
      setMessage(null);
      const response = await rejectAdminArticle(article.id, rejectionReason.trim());
      const nextArticle = response.article ?? null;
      await refreshArticles();
      if (nextArticle?.id !== undefined && nextArticle?.id !== null) {
        setSelectedArticleId(nextArticle.id);
      }
      setMessage('Đã từ chối bài viết và ghi lại lý do.');
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Không từ chối được bài viết');
    } finally {
      setBusyId(null);
    }
  }

  const loading = articlesQuery.isLoading;
  const queryError = articlesQuery.error instanceof Error ? articlesQuery.error.message : null;

  return (
    <div className="min-h-screen bg-miru-bg px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/35">
                <ShieldCheck size={14} />
                Admin review
              </div>
              <h1 className="mt-3 text-3xl font-bold md:text-4xl">Duyệt bài viết therapist</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                Xem nhanh bài đang chờ duyệt, đọc nội dung và phê duyệt hoặc trả về để chỉnh sửa thêm.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              Chế độ duyệt nội dung công khai
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard icon={FileText} label="Tổng bài" value={reviewStats.total} />
            <AdminStatCard icon={ShieldCheck} label="Chờ duyệt" value={reviewStats.pending} />
            <AdminStatCard icon={CheckCircle2} label="Đã đăng" value={reviewStats.published} />
            <AdminStatCard icon={CircleX} label="Từ chối" value={reviewStats.rejected} />
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
          <section className="glass-panel rounded-[30px] border border-white/10 p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-white/35">Hàng đợi</div>
                <h2 className="mt-2 text-2xl font-semibold text-white">Bài đang chờ duyệt</h2>
              </div>
              <button
                type="button"
                onClick={() => void refreshArticles()}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                Làm mới
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-36 animate-pulse rounded-[24px] border border-white/10 bg-white/5"
                  />
                ))
              ) : pendingArticles.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-white/50">
                  Hiện chưa có bài nào ở trạng thái chờ duyệt.
                </div>
              ) : (
                pendingArticles.map((article) => {
                  const meta = getArticleStatusMeta(article.status);
                  const isActive = String(selectedArticleId ?? '') === String(article.id ?? '');

                  return (
                    <button
                      key={String(article.id)}
                      type="button"
                      onClick={() => setSelectedArticleId(article.id)}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all ${
                        isActive
                          ? 'border-miru-primary/50 bg-miru-primary/10'
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
                        {cleanArticleText(article.excerpt, 'Chưa có tóm tắt.')}
                      </p>
                      <div className="mt-4 text-xs text-white/45">
                        Sửa lần cuối: {formatArticleDate(article.updated_at)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="glass-panel rounded-[30px] border border-white/10 p-5 md:p-6">
            {!selectedArticle ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/50">
                Chọn một bài ở bên trái để đọc chi tiết và duyệt.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-white/35">Chi tiết</div>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {cleanArticleText(selectedArticle.title, 'Bài viết')}
                    </h2>
                    <p className="mt-2 text-sm text-white/55">
                      Therapist: {cleanArticleText(selectedArticle.therapist_name, 'Chưa rõ')}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getArticleStatusMeta(selectedArticle.status).className}`}>
                    {getArticleStatusMeta(selectedArticle.status).label}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-white/35">Slug</div>
                    <div className="mt-1 font-medium text-white">{cleanArticleText(selectedArticle.slug, 'Chưa có slug')}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-white/35">Cover</div>
                    <div className="mt-1 font-medium text-white">
                      {cleanArticleText(selectedArticle.cover_image_url, 'Chưa có ảnh cover')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-white/35">SEO title</div>
                    <div className="mt-1 font-medium text-white">
                      {cleanArticleText(selectedArticle.seo_title, 'Chưa có SEO title')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-white/35">SEO description</div>
                    <div className="mt-1 font-medium text-white">
                      {cleanArticleText(selectedArticle.seo_description, 'Chưa có SEO description')}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-sm font-medium text-white/70">Tóm tắt</div>
                  <p className="mt-2 text-sm leading-7 text-white/65">
                    {cleanArticleText(selectedArticle.excerpt, 'Chưa có tóm tắt cho bài này.')}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="text-sm font-medium text-white/70">Nội dung</div>
                  <div className="mt-2 max-h-[360px] overflow-auto rounded-[24px] border border-white/10 bg-black/10 px-4 py-4 text-sm leading-7 whitespace-pre-wrap text-white/75">
                    {cleanArticleText(selectedArticle.content_markdown, 'Chưa có nội dung.')}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm text-white/65 md:grid-cols-3">
                  <div>Gửi duyệt: {formatArticleDate(selectedArticle.review_requested_at, 'Chưa gửi')}</div>
                  <div>Đăng công khai: {formatArticleDate(selectedArticle.published_at, 'Chưa đăng')}</div>
                  <div>Đã sửa: {formatArticleDate(selectedArticle.updated_at)}</div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-sm font-medium text-white/70">Lý do từ chối</div>
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
                    placeholder="Lý do từ chối hoặc hướng dẫn chỉnh sửa..."
                  />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleApprove(selectedArticle)}
                    disabled={busyId === selectedArticle.id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:opacity-60"
                  >
                    <CheckCircle2 size={16} />
                    {busyId === selectedArticle.id ? 'Đang duyệt...' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReject(selectedArticle)}
                    disabled={busyId === selectedArticle.id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-red-500/15 px-5 py-3 text-sm font-semibold text-red-100 transition-colors hover:bg-red-500/20 disabled:opacity-60"
                  >
                    <CircleX size={16} />
                    {busyId === selectedArticle.id ? 'Đang từ chối...' : 'Reject'}
                  </button>
                </div>
              </>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}
