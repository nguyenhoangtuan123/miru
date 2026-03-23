import axios from 'axios';
import { z } from 'zod';
import { api, parseApi } from './api';
import { IdSchema } from './contracts';

export const ArticleStatusSchema = z.enum([
  'draft',
  'pending_review',
  'published',
  'rejected',
  'archived',
]);

export const ArticleSchema = z
  .object({
    id: IdSchema,
    therapist_id: z.string().nullable().optional(),
    therapist_name: z.string().nullable().optional(),
    reviewer_name: z.string().nullable().optional(),
    title: z.string().default(''),
    slug: z.string().default(''),
    excerpt: z.string().nullable().optional(),
    cover_image_url: z.string().nullable().optional(),
    content_markdown: z.string().nullable().optional(),
    seo_title: z.string().nullable().optional(),
    seo_description: z.string().nullable().optional(),
    status: ArticleStatusSchema.default('draft'),
    review_requested_at: z.string().nullable().optional(),
    reviewed_at: z.string().nullable().optional(),
    published_at: z.string().nullable().optional(),
    archived_at: z.string().nullable().optional(),
    rejection_reason: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    therapist: z.record(z.unknown()).nullable().optional(),
    reviewer: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();

const NumericMetricSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}, z.number().default(0));

export const ArticleAnalyticsMetricBundleSchema = z
  .object({
    views: NumericMetricSchema.optional(),
    article_views: NumericMetricSchema.optional(),
    article_view_count: NumericMetricSchema.optional(),
    engaged_reads: NumericMetricSchema.optional(),
    engaged_read_count: NumericMetricSchema.optional(),
    profile_clicks: NumericMetricSchema.optional(),
    profile_click_count: NumericMetricSchema.optional(),
    contact_requests: NumericMetricSchema.optional(),
    contact_request_count: NumericMetricSchema.optional(),
    pairings: NumericMetricSchema.optional(),
    pairing_count: NumericMetricSchema.optional(),
    ai_sessions: NumericMetricSchema.optional(),
    ai_session_count: NumericMetricSchema.optional(),
    ai_messages: NumericMetricSchema.optional(),
    ai_message_count: NumericMetricSchema.optional(),
    login_prompt_clicks: NumericMetricSchema.optional(),
    login_prompt_click_count: NumericMetricSchema.optional(),
    question_count: NumericMetricSchema.optional(),
    answered_question_count: NumericMetricSchema.optional(),
  })
  .passthrough();

export const ArticleAnalyticsBucketSchema = z
  .object({
    source: z.string().optional(),
    tag: z.string().optional(),
    label: z.string().optional(),
    count: NumericMetricSchema.optional(),
    percentage: NumericMetricSchema.optional(),
  })
  .passthrough();

export const ArticleAnalyticsRecordSchema = z
  .object({
    article_id: IdSchema.optional(),
    article_slug: z.string().nullable().optional(),
    metrics: ArticleAnalyticsMetricBundleSchema.optional(),
    attribution: z.record(z.unknown()).optional(),
    sources: z.array(ArticleAnalyticsBucketSchema).optional(),
    attribution_sources: z.array(ArticleAnalyticsBucketSchema).optional(),
    top_sources: z.array(ArticleAnalyticsBucketSchema).optional(),
    topics: z.array(ArticleAnalyticsBucketSchema).optional(),
    top_topics: z.array(ArticleAnalyticsBucketSchema).optional(),
    reason_tags: z.array(z.string()).default([]),
    last_activity_at: z.string().nullable().optional(),
  })
  .passthrough();

export const ArticleFormSchema = z
  .object({
    title: z.string().trim().min(1).max(220),
    slug: z.string().trim().max(240).optional().default(''),
    excerpt: z.string().trim().max(600).optional().default(''),
    cover_image_url: z.string().trim().max(600).optional().default(''),
    content_markdown: z.string().max(50000).optional().default(''),
    seo_title: z.string().trim().max(220).optional().default(''),
    seo_description: z.string().trim().max(320).optional().default(''),
  })
  .passthrough();

export const ArticleListResponseSchema = z
  .object({
    success: z.boolean(),
    articles: z.array(ArticleSchema).optional(),
    reviews: z.array(ArticleSchema).optional(),
    items: z.array(ArticleSchema).optional(),
    count: z.number().optional(),
  })
  .passthrough()
  .transform((value) => {
    const articles = value.articles ?? value.reviews ?? value.items ?? [];
    return {
      success: value.success,
      articles,
      count: value.count ?? articles.length,
    };
  });

export const ArticleDetailResponseSchema = z
  .object({
    success: z.boolean(),
    article: ArticleSchema.nullable().optional(),
    review: ArticleSchema.nullable().optional(),
  })
  .passthrough()
  .transform((value) => ({
    success: value.success,
    article: value.article ?? value.review ?? null,
  }));

export const ArticleMutationResponseSchema = z
  .object({
    success: z.boolean(),
    article: ArticleSchema.nullable().optional(),
    review: ArticleSchema.nullable().optional(),
  })
  .passthrough()
  .transform((value) => ({
    success: value.success,
    article: value.article ?? value.review ?? null,
  }));

export const ArticleAnalyticsListResponseSchema = z
  .object({
    success: z.boolean().optional().default(true),
    available: z.boolean().optional(),
    analytics: z.array(ArticleAnalyticsRecordSchema).optional(),
    article_analytics: z.array(ArticleAnalyticsRecordSchema).optional(),
    items: z.array(ArticleAnalyticsRecordSchema).optional(),
    count: z.number().optional(),
  })
  .passthrough()
  .transform((value) => {
    const analytics =
      value.analytics ?? value.article_analytics ?? value.items ?? [];

    return {
      success: value.success ?? true,
      available: value.available ?? true,
      analytics,
      count: value.count ?? analytics.length,
    };
  });

export const ArticleQuestionStatusSchema = z.enum([
  'pending_review',
  'published',
  'answered',
  'hidden',
]);

export const ArticleQuestionSchema = z
  .object({
    id: IdSchema.optional(),
    question_id: z.string().nullable().optional(),
    article_id: IdSchema.optional(),
    article_slug: z.string().nullable().optional(),
    article_title: z.string().nullable().optional(),
    pseudonym: z.string().nullable().optional(),
    public_display_name: z.string().nullable().optional(),
    question_text: z.string().nullable().optional(),
    question: z.string().nullable().optional(),
    answer_text: z.string().nullable().optional(),
    answer: z.string().nullable().optional(),
    status: ArticleQuestionStatusSchema.default('pending_review'),
    answer_state: ArticleQuestionStatusSchema.optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    answered_at: z.string().nullable().optional(),
    published_at: z.string().nullable().optional(),
    hidden_at: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((value) => {
    const resolvedId = value.id ?? value.question_id ?? '';
    return {
      ...value,
      id: resolvedId,
      question_id: value.question_id ?? resolvedId,
      pseudonym: value.pseudonym ?? value.public_display_name ?? null,
      question_text: value.question_text ?? value.question ?? null,
      answer_text: value.answer_text ?? value.answer ?? null,
      answer_state: value.answer_state ?? value.status,
    };
  });

export const ArticleQuestionListResponseSchema = z
  .object({
    success: z.boolean().optional().default(true),
    available: z.boolean().optional(),
    questions: z.array(ArticleQuestionSchema).optional(),
    items: z.array(ArticleQuestionSchema).optional(),
    data: z.array(ArticleQuestionSchema).optional(),
    count: z.number().optional(),
  })
  .passthrough()
  .transform((value) => {
    const questions = value.questions ?? value.items ?? value.data ?? [];
    return {
      success: value.success ?? true,
      available: value.available ?? true,
      questions,
      count: value.count ?? questions.length,
    };
  });

export const ArticleQuestionMutationResponseSchema = z
  .object({
    success: z.boolean().optional().default(true),
    question: ArticleQuestionSchema.nullable().optional(),
    item: ArticleQuestionSchema.nullable().optional(),
    data: ArticleQuestionSchema.nullable().optional(),
  })
  .passthrough()
  .transform((value) => ({
    success: value.success ?? true,
    question: value.question ?? value.item ?? value.data ?? null,
  }));

export type ArticleStatus = z.infer<typeof ArticleStatusSchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type ArticleAnalyticsMetricBundle = z.infer<typeof ArticleAnalyticsMetricBundleSchema>;
export type ArticleAnalyticsBucket = z.infer<typeof ArticleAnalyticsBucketSchema>;
export type ArticleAnalyticsRecord = z.infer<typeof ArticleAnalyticsRecordSchema>;
export type ArticleQuestionStatus = z.infer<typeof ArticleQuestionStatusSchema>;
export type ArticleQuestion = z.infer<typeof ArticleQuestionSchema>;
export type ArticleQuestionListResponse = z.infer<typeof ArticleQuestionListResponseSchema>;
export type ArticleQuestionMutationResponse = z.infer<typeof ArticleQuestionMutationResponseSchema>;
export type ArticleForm = z.infer<typeof ArticleFormSchema>;
export type ArticleListResponse = z.infer<typeof ArticleListResponseSchema>;
export type ArticleDetailResponse = z.infer<typeof ArticleDetailResponseSchema>;
export type ArticleMutationResponse = z.infer<typeof ArticleMutationResponseSchema>;
export type ArticleAnalyticsListResponse = z.infer<typeof ArticleAnalyticsListResponseSchema>;

const ArticleListResponseSchemaForParse =
  ArticleListResponseSchema as unknown as z.ZodType<ArticleListResponse>;
const ArticleDetailResponseSchemaForParse =
  ArticleDetailResponseSchema as unknown as z.ZodType<ArticleDetailResponse>;
const ArticleMutationResponseSchemaForParse =
  ArticleMutationResponseSchema as unknown as z.ZodType<ArticleMutationResponse>;
const ArticleAnalyticsListResponseSchemaForParse =
  ArticleAnalyticsListResponseSchema as unknown as z.ZodType<ArticleAnalyticsListResponse>;
const ArticleQuestionListResponseSchemaForParse =
  ArticleQuestionListResponseSchema as unknown as z.ZodType<ArticleQuestionListResponse>;
const ArticleQuestionMutationResponseSchemaForParse =
  ArticleQuestionMutationResponseSchema as unknown as z.ZodType<ArticleQuestionMutationResponse>;

export async function getPublicArticles(limit?: number) {
  return parseApi(
    api.get('/api/articles', {
      params: typeof limit === 'number' ? { limit } : undefined,
    }),
    ArticleListResponseSchemaForParse
  );
}

export async function getPublicArticle(slug: string) {
  return parseApi(
    api.get(`/api/articles/${encodeURIComponent(slug)}`),
    ArticleDetailResponseSchemaForParse
  );
}

export async function getMyTherapistArticles() {
  return parseApi(api.get('/api/therapist/articles/me'), ArticleListResponseSchemaForParse);
}

export async function getMyTherapistArticleAnalytics() {
  const candidates = [
    '/api/therapist/articles/me/analytics',
    '/api/therapist/articles/analytics',
  ];

  for (const path of candidates) {
    try {
      return await parseApi(api.get(path), ArticleAnalyticsListResponseSchemaForParse);
    } catch (error) {
      if (axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status ?? 0)) {
        continue;
      }
      throw error;
    }
  }

  return {
    success: false,
    available: false,
    analytics: [],
    count: 0,
  } satisfies ArticleAnalyticsListResponse;
}

export async function getMyTherapistArticleQuestions(status?: ArticleQuestionStatus | 'all') {
  const candidates = [
    '/api/therapist/articles/me/questions',
    '/api/therapist/articles/questions/me',
  ];
  const params =
    status && status !== 'all' ? { status } : undefined;

  for (const path of candidates) {
    try {
      return await parseApi(
        api.get(path, { params }),
        ArticleQuestionListResponseSchemaForParse
      );
    } catch (error) {
      if (axios.isAxiosError(error) && [404, 405, 501].includes(error.response?.status ?? 0)) {
        continue;
      }
      throw error;
    }
  }

  return {
    success: false,
    available: false,
    questions: [],
    count: 0,
  } satisfies ArticleQuestionListResponse;
}

export async function answerTherapistArticleQuestion(
  questionId: string | number,
  answer_text: string
) {
  return parseApi(
    api.post(`/api/therapist/articles/questions/${encodeURIComponent(String(questionId))}/answer`, {
      answer_text,
    }),
    ArticleQuestionMutationResponseSchemaForParse
  );
}

export async function publishTherapistArticleQuestion(questionId: string | number) {
  return parseApi(
    api.post(`/api/therapist/articles/questions/${encodeURIComponent(String(questionId))}/publish`),
    ArticleQuestionMutationResponseSchemaForParse
  );
}

export async function hideTherapistArticleQuestion(questionId: string | number) {
  return parseApi(
    api.post(`/api/therapist/articles/questions/${encodeURIComponent(String(questionId))}/hide`),
    ArticleQuestionMutationResponseSchemaForParse
  );
}

export async function createTherapistArticle(payload: ArticleForm) {
  return parseApi(
    api.post('/api/therapist/articles', ArticleFormSchema.parse(payload)),
    ArticleMutationResponseSchemaForParse
  );
}

export async function updateTherapistArticle(articleId: string | number, payload: ArticleForm) {
  return parseApi(
    api.put(`/api/therapist/articles/${encodeURIComponent(String(articleId))}`, ArticleFormSchema.parse(payload)),
    ArticleMutationResponseSchemaForParse
  );
}

export async function submitTherapistArticle(articleId: string | number) {
  return parseApi(
    api.post(`/api/therapist/articles/${encodeURIComponent(String(articleId))}/submit`),
    ArticleMutationResponseSchemaForParse
  );
}

export async function archiveTherapistArticle(articleId: string | number) {
  return parseApi(
    api.post(`/api/therapist/articles/${encodeURIComponent(String(articleId))}/archive`),
    ArticleMutationResponseSchemaForParse
  );
}

export async function getAdminArticleReviews() {
  return parseApi(api.get('/api/admin/articles/review'), ArticleListResponseSchemaForParse);
}

export async function approveAdminArticle(articleId: string | number) {
  return parseApi(
    api.post(`/api/admin/articles/${encodeURIComponent(String(articleId))}/approve`),
    ArticleMutationResponseSchemaForParse
  );
}

export async function rejectAdminArticle(articleId: string | number, reason?: string) {
  return parseApi(
    api.post(`/api/admin/articles/${encodeURIComponent(String(articleId))}/reject`, {
      rejection_reason: reason ?? '',
    }),
    ArticleMutationResponseSchemaForParse
  );
}
