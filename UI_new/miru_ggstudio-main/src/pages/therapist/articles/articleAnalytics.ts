import type { Article, ArticleAnalyticsListResponse } from '../../../services/articles';

export type TherapistArticleAnalytics = {
  articleId: string | null;
  articleSlug: string | null;
  viewCount: number;
  engagedReadCount: number;
  profileClickCount: number;
  contactRequestCount: number;
  pairingCount: number;
  aiSessionCount: number;
  aiMessageCount: number;
  loginPromptCount: number;
  questionCount: number;
  answeredQuestionCount: number;
  attributionSources: Array<{
    source: string;
    label: string;
    count: number;
    percentage: number | null;
  }>;
  topicTags: Array<{
    tag: string;
    label: string;
    count: number;
  }>;
  reasonTags: string[];
  lastActivityAt: string | null;
  hasMeaningfulData: boolean;
};

export type TherapistArticleAnalyticsIndex = {
  byId: Map<string, TherapistArticleAnalytics>;
  bySlug: Map<string, TherapistArticleAnalytics>;
  items: TherapistArticleAnalytics[];
  endpointAvailable: boolean;
  hasAnyMetrics: boolean;
};

export type TherapistArticleAnalyticsSummary = {
  totalViews: number;
  totalEngagedReads: number;
  totalProfileClicks: number;
  totalContactRequests: number;
  totalPairings: number;
  totalQuestions: number;
  totalAnsweredQuestions: number;
  publishedTrackedCount: number;
};

const SOURCE_LABELS: Record<string, string> = {
  article: 'Từ bài viết',
  related_article: 'Từ bài liên quan',
  directory: 'Từ danh bạ therapist',
  profile_direct_link: 'Từ link hồ sơ trực tiếp',
  therapist_invite: 'Từ lời mời therapist',
  referral: 'Từ giới thiệu',
  landing_page: 'Từ landing page',
  search: 'Từ khám phá chủ đề',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(record: Record<string, unknown> | null, keys: string[]): number {
  if (!record) return 0;
  for (const key of keys) {
    const numeric = readNumber(record[key]);
    if (numeric !== null) {
      return numeric;
    }
  }
  return 0;
}

function pickString(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function toBucketLabel(source: string, fallbackLabel?: string | null) {
  if (fallbackLabel && fallbackLabel.trim()) {
    return fallbackLabel.trim();
  }
  const normalized = source.trim().toLowerCase();
  return SOURCE_LABELS[normalized] ?? normalized.replace(/_/g, ' ');
}

function normalizeBuckets(values: unknown[], keyName: 'source' | 'tag') {
  return values
    .map((value) => {
      const item = asRecord(value);
      if (!item) return null;
      const key = pickString(item, [keyName, 'name', 'id']);
      if (!key) return null;
      return {
        key,
        label: toBucketLabel(key, pickString(item, ['label', 'display_name', 'title'])),
        count: pickNumber(item, ['count', 'value', 'total']),
        percentage: readNumber(item.percentage) ?? null,
      };
    })
    .filter((value): value is { key: string; label: string; count: number; percentage: number | null } =>
      Boolean(value)
    )
    .sort((left, right) => right.count - left.count);
}

function bucketArrayFromRecord(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return [];
  for (const key of keys) {
    const values = asArray(record[key]);
    if (values.length > 0) {
      return values;
    }
  }
  return [];
}

function normalizeAnalyticsFromRecord(
  record: Record<string, unknown> | null,
  fallbackId: string | null,
  fallbackSlug: string | null
): TherapistArticleAnalytics | null {
  if (!record) return null;

  const metricsRecord =
    asRecord(record.metrics) ??
    asRecord(record.analytics) ??
    asRecord(record.performance) ??
    asRecord(record.summary) ??
    record;

  const attributionRecord =
    asRecord(record.attribution) ??
    asRecord(record.attribution_summary) ??
    asRecord(record.sources_summary) ??
    record;

  const attributionSources = normalizeBuckets(
    bucketArrayFromRecord(attributionRecord, ['attribution_sources', 'sources', 'top_sources']),
    'source'
  ).map((bucket) => ({
    source: bucket.key,
    label: bucket.label,
    count: bucket.count,
    percentage: bucket.percentage,
  }));

  const topicTags = normalizeBuckets(
    bucketArrayFromRecord(attributionRecord, ['top_topics', 'topics', 'reason_tags']),
    'tag'
  ).map((bucket) => ({
    tag: bucket.key,
    label: bucket.label,
    count: bucket.count,
  }));

  const articleId =
    pickString(record, ['article_id', 'id']) ??
    (fallbackId && fallbackId.trim() ? fallbackId : null);
  const articleSlug =
    pickString(record, ['article_slug', 'slug']) ??
    (fallbackSlug && fallbackSlug.trim() ? fallbackSlug : null);

  const normalized: TherapistArticleAnalytics = {
    articleId,
    articleSlug,
    viewCount: pickNumber(metricsRecord, ['views', 'article_views', 'article_view_count', 'view_count']),
    engagedReadCount: pickNumber(metricsRecord, ['engaged_reads', 'engaged_read_count']),
    profileClickCount: pickNumber(metricsRecord, ['profile_clicks', 'profile_click_count']),
    contactRequestCount: pickNumber(metricsRecord, ['contact_requests', 'contact_request_count']),
    pairingCount: pickNumber(metricsRecord, ['pairings', 'pairing_count']),
    aiSessionCount: pickNumber(metricsRecord, ['ai_sessions', 'ai_session_count']),
    aiMessageCount: pickNumber(metricsRecord, ['ai_messages', 'ai_message_count']),
    loginPromptCount: pickNumber(metricsRecord, ['login_prompt_clicks', 'login_prompt_click_count']),
    questionCount: pickNumber(metricsRecord, ['question_count', 'questions', 'questionCount']),
    answeredQuestionCount: pickNumber(metricsRecord, [
      'answered_question_count',
      'answered_questions',
      'answeredQuestionCount',
    ]),
    attributionSources,
    topicTags,
    reasonTags: [
      ...new Set(
        asArray(record.reason_tags)
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      ),
    ],
    lastActivityAt: pickString(record, ['last_activity_at', 'latest_activity_at', 'updated_at']),
    hasMeaningfulData: false,
  };

  normalized.hasMeaningfulData =
    normalized.viewCount > 0 ||
    normalized.engagedReadCount > 0 ||
    normalized.profileClickCount > 0 ||
    normalized.contactRequestCount > 0 ||
    normalized.pairingCount > 0 ||
    normalized.aiSessionCount > 0 ||
    normalized.aiMessageCount > 0 ||
    normalized.loginPromptCount > 0 ||
    normalized.questionCount > 0 ||
    normalized.answeredQuestionCount > 0 ||
    normalized.attributionSources.length > 0 ||
    normalized.topicTags.length > 0;

  if (!normalized.articleId && !normalized.articleSlug && !normalized.hasMeaningfulData) {
    return null;
  }

  return normalized;
}

function mergeBuckets<
  TValue extends { count: number },
  TKey extends keyof TValue,
>(primary: TValue[], secondary: TValue[], key: TKey) {
  if (primary.length === 0) {
    return secondary;
  }
  if (secondary.length === 0) {
    return primary;
  }

  const merged = new Map<string, TValue>();
  for (const item of [...primary, ...secondary]) {
    const bucketKey = String(item[key]);
    const existing = merged.get(bucketKey);
    if (!existing || item.count > existing.count) {
      merged.set(bucketKey, item);
    }
  }
  return Array.from(merged.values()).sort((left, right) => right.count - left.count);
}

function mergeAnalytics(
  primary: TherapistArticleAnalytics,
  secondary: TherapistArticleAnalytics
): TherapistArticleAnalytics {
  const merged: TherapistArticleAnalytics = {
    articleId: primary.articleId ?? secondary.articleId,
    articleSlug: primary.articleSlug ?? secondary.articleSlug,
    viewCount: primary.viewCount || secondary.viewCount,
    engagedReadCount: primary.engagedReadCount || secondary.engagedReadCount,
    profileClickCount: primary.profileClickCount || secondary.profileClickCount,
    contactRequestCount: primary.contactRequestCount || secondary.contactRequestCount,
    pairingCount: primary.pairingCount || secondary.pairingCount,
    aiSessionCount: primary.aiSessionCount || secondary.aiSessionCount,
    aiMessageCount: primary.aiMessageCount || secondary.aiMessageCount,
    loginPromptCount: primary.loginPromptCount || secondary.loginPromptCount,
    questionCount: primary.questionCount || secondary.questionCount,
    answeredQuestionCount: primary.answeredQuestionCount || secondary.answeredQuestionCount,
    attributionSources: mergeBuckets(primary.attributionSources, secondary.attributionSources, 'source'),
    topicTags: mergeBuckets(primary.topicTags, secondary.topicTags, 'tag'),
    reasonTags: Array.from(new Set([...primary.reasonTags, ...secondary.reasonTags])),
    lastActivityAt: primary.lastActivityAt ?? secondary.lastActivityAt,
    hasMeaningfulData: primary.hasMeaningfulData || secondary.hasMeaningfulData,
  };

  return merged;
}

function toLookupKeys(article: Pick<Article, 'id' | 'slug'> | TherapistArticleAnalytics) {
  const keys: string[] = [];
  const articleId = 'articleId' in article ? article.articleId : article.id;
  const articleSlug = 'articleSlug' in article ? article.articleSlug : article.slug;

  if (articleId !== undefined && articleId !== null && String(articleId).trim()) {
    keys.push(`id:${String(articleId).trim()}`);
  }
  if (typeof articleSlug === 'string' && articleSlug.trim()) {
    keys.push(`slug:${articleSlug.trim()}`);
  }
  return keys;
}

export function buildTherapistArticleAnalyticsIndex(
  articles: Article[],
  response?: ArticleAnalyticsListResponse | null
): TherapistArticleAnalyticsIndex {
  const byId = new Map<string, TherapistArticleAnalytics>();
  const bySlug = new Map<string, TherapistArticleAnalytics>();
  const rawIndex = new Map<string, TherapistArticleAnalytics>();
  const endpointAnalytics = response?.analytics ?? [];

  for (const item of endpointAnalytics) {
    const normalized = normalizeAnalyticsFromRecord(
      item as unknown as Record<string, unknown>,
      item.article_id !== undefined && item.article_id !== null ? String(item.article_id) : null,
      item.article_slug ?? null
    );
    if (!normalized) continue;
    for (const key of toLookupKeys(normalized)) {
      rawIndex.set(key, normalized);
    }
  }

  for (const article of articles) {
    const embedded = normalizeAnalyticsFromRecord(
      article as unknown as Record<string, unknown>,
      article.id !== undefined && article.id !== null ? String(article.id) : null,
      article.slug ?? null
    );

    const existing =
      rawIndex.get(`id:${String(article.id ?? '').trim()}`) ??
      rawIndex.get(`slug:${String(article.slug ?? '').trim()}`);

    const merged =
      existing && embedded ? mergeAnalytics(existing, embedded) : existing ?? embedded ?? null;

    if (!merged) {
      continue;
    }

    if (merged.articleId) {
      byId.set(String(merged.articleId), merged);
    }
    if (merged.articleSlug) {
      bySlug.set(merged.articleSlug, merged);
    }
  }

  const deduped = new Map<string, TherapistArticleAnalytics>();
  for (const article of articles) {
    const match = findArticleAnalytics(article, { byId, bySlug, items: [], endpointAvailable: false, hasAnyMetrics: false });
    if (!match) continue;
    const key = match.articleId ? `id:${match.articleId}` : `slug:${match.articleSlug ?? ''}`;
    deduped.set(key, match);
  }

  for (const value of rawIndex.values()) {
    const key = value.articleId ? `id:${value.articleId}` : `slug:${value.articleSlug ?? ''}`;
    if (!deduped.has(key)) {
      deduped.set(key, value);
    }
  }

  const items = Array.from(deduped.values());
  const hasAnyMetrics = items.some((item) => item.hasMeaningfulData);

  return {
    byId,
    bySlug,
    items,
    endpointAvailable: Boolean(response?.available),
    hasAnyMetrics,
  };
}

export function findArticleAnalytics(
  article: Pick<Article, 'id' | 'slug'>,
  index: TherapistArticleAnalyticsIndex
) {
  const articleId =
    article.id !== undefined && article.id !== null ? String(article.id).trim() : '';
  if (articleId && index.byId.has(articleId)) {
    return index.byId.get(articleId) ?? null;
  }
  const articleSlug = typeof article.slug === 'string' ? article.slug.trim() : '';
  if (articleSlug && index.bySlug.has(articleSlug)) {
    return index.bySlug.get(articleSlug) ?? null;
  }
  return null;
}

export function summarizeTherapistArticleAnalytics(
  articles: Article[],
  index: TherapistArticleAnalyticsIndex
): TherapistArticleAnalyticsSummary {
  const summary: TherapistArticleAnalyticsSummary = {
    totalViews: 0,
    totalEngagedReads: 0,
    totalProfileClicks: 0,
    totalContactRequests: 0,
    totalPairings: 0,
    totalQuestions: 0,
    totalAnsweredQuestions: 0,
    publishedTrackedCount: 0,
  };

  for (const article of articles) {
    const analytics = findArticleAnalytics(article, index);
    if (!analytics) continue;
    summary.totalViews += analytics.viewCount;
    summary.totalEngagedReads += analytics.engagedReadCount;
    summary.totalProfileClicks += analytics.profileClickCount;
    summary.totalContactRequests += analytics.contactRequestCount;
    summary.totalPairings += analytics.pairingCount;
    summary.totalQuestions += analytics.questionCount;
    summary.totalAnsweredQuestions += analytics.answeredQuestionCount;
    if (article.status === 'published' && analytics.hasMeaningfulData) {
      summary.publishedTrackedCount += 1;
    }
  }

  return summary;
}

export function formatAnalyticsMetric(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(value)));
}

export function formatAnalyticsRate(numerator: number, denominator: number) {
  if (denominator <= 0 || numerator <= 0) {
    return '0%';
  }
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function buildAnalyticsInsights(
  article: Pick<Article, 'status'>,
  analytics: TherapistArticleAnalytics | null
) {
  if (!analytics) {
    return article.status === 'published'
      ? ['Bài đã được đăng công khai. Analytics chi tiết sẽ xuất hiện khi public event tracking ghi nhận lượt đọc đầu tiên.']
      : ['Analytics bắt đầu có ý nghĩa sau khi bài được publish và có người đọc đi qua hồ sơ hoặc gửi liên hệ.'];
  }

  const insights: string[] = [];

  if (analytics.pairingCount > 0) {
    insights.push(
      `Bài này đã tạo ${formatAnalyticsMetric(analytics.pairingCount)} ghép nối thành công từ ${
        analytics.contactRequestCount > 0 ? formatAnalyticsMetric(analytics.contactRequestCount) : 'các'
      } yêu cầu liên hệ.`
    );
  }

  if (analytics.viewCount >= 50 && analytics.profileClickCount <= Math.max(1, analytics.viewCount * 0.05)) {
    insights.push('Lượt đọc đang có nhưng click sang hồ sơ còn thấp. Nên làm rõ CTA cuối bài hoặc phần giới thiệu therapist.');
  }

  if (analytics.profileClickCount > 0 && analytics.contactRequestCount === 0) {
    insights.push('Đã có người đọc mở hồ sơ từ bài này nhưng chưa gửi yêu cầu liên hệ. Có thể cần tín hiệu uy tín hoặc giá dịch vụ rõ hơn.');
  }

  if (analytics.contactRequestCount > 0 && analytics.pairingCount === 0) {
    insights.push('Bài này đã tạo lead bước đầu. Hãy theo dõi funnel liên hệ để xem khâu phản hồi hay pairing đang làm rơi chuyển đổi.');
  }

  if (analytics.topicTags.length > 0) {
    const topTopic = analytics.topicTags[0];
    insights.push(`Chủ đề kéo sự quan tâm nhiều nhất hiện tại là "${topTopic.label}" với ${formatAnalyticsMetric(topTopic.count)} tín hiệu đọc/click.`);
  }

  if (analytics.aiSessionCount > 0 || analytics.loginPromptCount > 0) {
    insights.push('Người đọc đã bắt đầu tương tác với AI trong bài. Đây là tín hiệu tốt để thử CTA sang app hoặc lời mời khám phá therapist phù hợp hơn.');
  }

  if (analytics.questionCount > 0) {
    insights.push(
      `BÃ i nÃ y Ä‘ang nháº­n ${formatAnalyticsMetric(analytics.questionCount)} cÃ¢u há»i tá»« cá»™ng Ä‘á»“ng, trong Ä‘Ã³ ${formatAnalyticsMetric(analytics.answeredQuestionCount)} cÃ¢u Ä‘Ã£ cÃ³ tráº£ lá»i.`
    );
  }

  if (insights.length === 0) {
    insights.push('Bài đang ở giai đoạn đầu của funnel. Hãy tiếp tục theo dõi lượt đọc, click hồ sơ và yêu cầu liên hệ để biết chủ đề nào chuyển đổi tốt nhất.');
  }

  return insights;
}
