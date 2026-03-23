import type { ArticleQuestion, ArticleQuestionStatus } from '../../../services/articles';

export type NormalizedArticleQuestion = {
  id: string;
  articleId: string | null;
  articleSlug: string | null;
  articleTitle: string;
  pseudonym: string;
  questionText: string;
  answerText: string;
  status: ArticleQuestionStatus;
  answerState: ArticleQuestionStatus;
  createdAt: string | null;
  updatedAt: string | null;
  answeredAt: string | null;
  publishedAt: string | null;
  hiddenAt: string | null;
};

export const ARTICLE_QUESTION_FILTERS: Array<{ value: ArticleQuestionStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending_review', label: 'Chờ duyệt' },
  { value: 'answered', label: 'Đã trả lời' },
  { value: 'published', label: 'Đã đăng' },
  { value: 'hidden', label: 'Đã ẩn' },
];

export const ARTICLE_QUESTION_STATUS_META: Record<
  ArticleQuestionStatus | 'all',
  { label: string; className: string; tone: string }
> = {
  all: {
    label: 'Tất cả',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    tone: 'Tổng hợp',
  },
  pending_review: {
    label: 'Chờ duyệt',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    tone: 'Cần xử lý',
  },
  published: {
    label: 'Đã đăng',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    tone: 'Công khai',
  },
  answered: {
    label: 'Đã trả lời',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
    tone: 'Đã phản hồi',
  },
  hidden: {
    label: 'Đã ẩn',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    tone: 'Ẩn khỏi community',
  },
};

export function normalizeArticleQuestion(question: ArticleQuestion): NormalizedArticleQuestion {
  const rawStatus = (question.answer_state ?? question.status ?? 'pending_review') as ArticleQuestionStatus;
  const answerState = rawStatus;
  const answerText =
    [question.answer_text, question.answer].find((value) => typeof value === 'string' && value.trim()) ?? '';

  return {
    id: String(question.id ?? question.question_id ?? ''),
    articleId:
      question.article_id !== undefined && question.article_id !== null
        ? String(question.article_id)
        : null,
    articleSlug:
      typeof question.article_slug === 'string' && question.article_slug.trim()
        ? question.article_slug.trim()
        : null,
    articleTitle:
      [question.article_title].find((value) => typeof value === 'string' && value.trim())?.trim() ??
      'Bài viết community',
    pseudonym:
      [question.pseudonym, question.public_display_name]
        .find((value) => typeof value === 'string' && value.trim())
        ?.trim() ?? 'Ẩn danh',
    questionText:
      [question.question_text, question.question]
        .find((value) => typeof value === 'string' && value.trim())
        ?.trim() ?? 'Chưa có nội dung câu hỏi.',
    answerText: answerText.trim(),
    status: rawStatus,
    answerState,
    createdAt:
      typeof question.created_at === 'string' && question.created_at.trim()
        ? question.created_at.trim()
        : null,
    updatedAt:
      typeof question.updated_at === 'string' && question.updated_at.trim()
        ? question.updated_at.trim()
        : null,
    answeredAt:
      typeof question.answered_at === 'string' && question.answered_at.trim()
        ? question.answered_at.trim()
        : null,
    publishedAt:
      typeof question.published_at === 'string' && question.published_at.trim()
        ? question.published_at.trim()
        : null,
    hiddenAt:
      typeof question.hidden_at === 'string' && question.hidden_at.trim()
        ? question.hidden_at.trim()
        : null,
  };
}

export function summarizeArticleQuestions(questions: ArticleQuestion[]) {
  const summary = {
    total: questions.length,
    pending_review: 0,
    answered: 0,
    published: 0,
    hidden: 0,
  };

  for (const question of questions) {
    const status = (question.answer_state ?? question.status ?? 'pending_review') as ArticleQuestionStatus;
    if (status in summary) {
      summary[status as keyof typeof summary] += 1;
    }
  }

  return summary;
}
