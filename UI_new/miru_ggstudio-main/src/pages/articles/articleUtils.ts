import type { Article, ArticleStatus } from '../../services/articles';

export const ARTICLE_STATUS_META: Record<
  ArticleStatus,
  { label: string; className: string; description: string }
> = {
  draft: {
    label: 'Nháp',
    className:
      'border-slate-200 bg-white/80 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65',
    description: 'Chưa gửi duyệt',
  },
  pending_review: {
    label: 'Chờ duyệt',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100',
    description: 'Đang chờ admin xem',
  },
  published: {
    label: 'Đã đăng',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100',
    description: 'Đang hiển thị công khai',
  },
  rejected: {
    label: 'Từ chối',
    className:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100',
    description: 'Cần chỉnh sửa hoặc bổ sung',
  },
  archived: {
    label: 'Lưu trữ',
    className:
      'border-white/10 bg-white/5 text-white/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50',
    description: 'Không còn xuất hiện ở danh sách chính',
  },
};

export function getArticleStatusMeta(status?: string | null) {
  const normalized = (status || 'draft') as ArticleStatus;
  return ARTICLE_STATUS_META[normalized] ?? ARTICLE_STATUS_META.draft;
}

export function formatArticleDate(value?: string | null, fallback = 'Chưa có dữ liệu') {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function cleanArticleText(value?: string | null, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  return text || fallback;
}

export function createArticleDraft(seed?: Partial<Article> | null) {
  return {
    title: seed?.title ?? '',
    slug: seed?.slug ?? '',
    excerpt: seed?.excerpt ?? '',
    cover_image_url: seed?.cover_image_url ?? '',
    content_markdown: seed?.content_markdown ?? '',
    seo_title: seed?.seo_title ?? '',
    seo_description: seed?.seo_description ?? '',
  };
}

export type ArticleDraft = ReturnType<typeof createArticleDraft>;
