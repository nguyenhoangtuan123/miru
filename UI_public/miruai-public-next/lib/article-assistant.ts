import { API_BASE_URL } from "./api";
import type { PublicArticle } from "./types";
import { getViewerState } from "./public-events";

const MONTHLY_USAGE_KEY = "miru_public_article_ai_usage";
export const ANONYMOUS_MONTHLY_QUOTA = 3;
export const AUTHENTICATED_MONTHLY_QUOTA = 12;
export const ENTITLED_MONTHLY_QUOTA = 40;

export type ArticleAssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type ArticleAssistantSession = {
  session_id: string;
  remaining_quota: number;
  quota_scope: "anonymous_monthly" | "signed_in_monthly" | "entitled_monthly";
  is_authenticated: boolean;
  upgrade_prompt: string | null;
};

type ArticleAssistantQuotaState = {
  used: number;
  limit: number;
  remaining: number;
  isAuthenticated: boolean;
  quotaScope: ArticleAssistantSession["quota_scope"];
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function usageStorageKey(articleSlug: string) {
  return `${MONTHLY_USAGE_KEY}:${currentMonthKey()}:${articleSlug}`;
}

function safeStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function normalizeQuotaScope(
  value: unknown,
  fallback: ArticleAssistantSession["quota_scope"],
): ArticleAssistantSession["quota_scope"] {
  if (value === "entitled_monthly") {
    return "entitled_monthly";
  }
  if (value === "signed_in_monthly") {
    return "signed_in_monthly";
  }
  if (value === "anonymous_monthly") {
    return "anonymous_monthly";
  }
  return fallback;
}

function getQuotaLimit(quotaScope: ArticleAssistantSession["quota_scope"]) {
  if (quotaScope === "entitled_monthly") {
    return ENTITLED_MONTHLY_QUOTA;
  }
  if (quotaScope === "signed_in_monthly") {
    return AUTHENTICATED_MONTHLY_QUOTA;
  }
  return ANONYMOUS_MONTHLY_QUOTA;
}

function writeUsageSnapshot(articleSlug: string, used: number) {
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  storage.setItem(usageStorageKey(articleSlug), String(Math.max(0, used)));
}

export function readAssistantQuota(articleSlug: string): ArticleAssistantQuotaState {
  const viewer = getViewerState();
  const storage = safeStorage();
  const key = usageStorageKey(articleSlug);
  const raw = storage?.getItem(key);
  const used = raw ? Number(raw) || 0 : 0;
  const quotaScope = viewer.is_authenticated ? "signed_in_monthly" : "anonymous_monthly";
  const limit = getQuotaLimit(quotaScope);

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    isAuthenticated: viewer.is_authenticated,
    quotaScope,
  };
}

function consumeQuota(articleSlug: string) {
  const storage = safeStorage();
  if (!storage) {
    return readAssistantQuota(articleSlug);
  }
  const key = usageStorageKey(articleSlug);
  const current = readAssistantQuota(articleSlug);
  const nextUsed = Math.min(current.limit, current.used + 1);
  storage.setItem(key, String(nextUsed));
  return readAssistantQuota(articleSlug);
}

async function postJson(path: string, body: Record<string, unknown>) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function startArticleAssistantSession(article: PublicArticle) {
  const viewer = getViewerState();
  const quota = readAssistantQuota(article.slug);

  const response = await postJson(`/api/public/articles/${encodeURIComponent(article.slug)}/assistant/session`, {
    anonymous_id: viewer.anonymous_id,
    session_id: viewer.session_id,
    user_id: viewer.user_id,
    article_slug: article.slug,
    therapist_id: article.therapist_id || null,
  });
  const quotaScope = normalizeQuotaScope(response?.quota_scope, quota.quotaScope);
  const isAuthenticated =
    typeof response?.is_authenticated === "boolean"
      ? response.is_authenticated
      : quotaScope !== "anonymous_monthly";
  const remainingQuota =
    typeof response?.remaining_quota === "number" ? response.remaining_quota : quota.remaining;
  writeUsageSnapshot(article.slug, Math.max(0, getQuotaLimit(quotaScope) - remainingQuota));

  return {
    session_id: String(response?.session_id || viewer.session_id),
    remaining_quota: remainingQuota,
    quota_scope: quotaScope,
    is_authenticated: isAuthenticated,
    upgrade_prompt:
      typeof response?.upgrade_prompt === "string"
        ? response.upgrade_prompt
        : isAuthenticated
          ? "Quota mo rong dang di theo goi Miru trong app."
          : "Dang nhap de mo them quota hoi dap va giu mach trao doi sau hon.",
  } satisfies ArticleAssistantSession;
}

function buildFallbackReply(article: PublicArticle, prompt: string, topicTags: string[]) {
  const lead = article.excerpt || article.seo_description || article.title;
  const topTopic = topicTags[0] || "dieu ban dang quan tam";

  if (/therapist|nhà trị liệu|nha tri lieu|phù hợp|phu hop/i.test(prompt)) {
    return `Tu bai viet nay, Miru dang thay ban quan tam nhieu toi ${topTopic.toLowerCase()}. Minh co the goi y therapist phu hop hon o phan ben duoi de ban xem cach ho lam viec va gui yeu cau lien he.`;
  }

  if (/bắt đầu|bat dau|bước nhỏ|buoc nho|nên làm gì|nen lam gi/i.test(prompt)) {
    return `Mot buoc nho tu bai viet nay la: chon dung mot dieu dang nang nhat, goi ten no that ngan, roi giu nhip cham lai truoc khi lam them gi khac. Miru dang dua tren y chinh: "${lead}".`;
  }

  return `Miru dang bam theo mach cua bai "${article.title}". Dieu noi bat nhat o day la ${topTopic.toLowerCase()} dang can duoc nhin bang nhip cham va an toan hon, thay vi ep ban giai quyet moi thu ngay lap tuc.`;
}

export async function sendArticleAssistantMessage(
  article: PublicArticle,
  prompt: string,
  topicTags: string[],
  sessionId: string,
) {
  const viewer = getViewerState();
  const before = readAssistantQuota(article.slug);
  if (before.remaining <= 0) {
    return {
      session: await startArticleAssistantSession(article),
      reply: null,
      exhausted: true,
    };
  }

  const response = await postJson(`/api/public/articles/${encodeURIComponent(article.slug)}/assistant/message`, {
    anonymous_id: viewer.anonymous_id,
    session_id: sessionId,
    user_id: viewer.user_id,
    article_slug: article.slug,
    message: prompt,
  });

  const fallbackAfter = consumeQuota(article.slug);
  const fallbackReply = buildFallbackReply(article, prompt, topicTags);
  const quotaScope = normalizeQuotaScope(response?.quota_scope, fallbackAfter.quotaScope);
  const isAuthenticated =
    typeof response?.is_authenticated === "boolean"
      ? response.is_authenticated
      : quotaScope !== "anonymous_monthly";
  const remainingQuota =
    typeof response?.remaining_quota === "number"
      ? response.remaining_quota
      : fallbackAfter.remaining;
  writeUsageSnapshot(article.slug, Math.max(0, getQuotaLimit(quotaScope) - remainingQuota));

  return {
    session: {
      session_id: String(response?.session_id || sessionId),
      remaining_quota: remainingQuota,
      quota_scope: quotaScope,
      is_authenticated: isAuthenticated,
      upgrade_prompt:
        typeof response?.upgrade_prompt === "string"
          ? response.upgrade_prompt
          : isAuthenticated
            ? "Quota con lai cua ban dang duoc tinh trong goi Miru."
            : "Dang nhap de mo them quota trong thang nay va tiep tuc hoi sau hon.",
    } satisfies ArticleAssistantSession,
    reply:
      typeof response?.reply === "string"
        ? response.reply
        : typeof response?.message === "string"
          ? response.message
          : fallbackReply,
    exhausted: response?.exhausted === true,
  };
}
