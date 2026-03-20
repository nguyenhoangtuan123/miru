"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { APP_URL, SITE_URL } from "../../lib/api";
import {
  ANONYMOUS_MONTHLY_QUOTA,
  AUTHENTICATED_MONTHLY_QUOTA,
  ENTITLED_MONTHLY_QUOTA,
  readAssistantQuota,
  sendArticleAssistantMessage,
  startArticleAssistantSession,
  type ArticleAssistantMessage,
} from "../../lib/article-assistant";
import { trackPublicEvent } from "../../lib/public-events";
import { buildAssistantPrompts } from "../../lib/topic-intent";
import type { PublicArticle } from "../../lib/types";
import { PublicLoginUpliftLink } from "./PublicLoginUpliftLink";
import { TrackedPublicLink } from "./TrackedPublicLink";

type ArticleAiCompanionProps = {
  article: PublicArticle;
  topicTags: string[];
};

type StoredArticleAiState = {
  messages: ArticleAssistantMessage[];
  draft: string;
  sessionId: string | null;
  sessionStarted: boolean;
};

const STORAGE_PREFIX = "miru_public_article_ai_state";

function storageKey(articleSlug: string) {
  return `${STORAGE_PREFIX}:${articleSlug}`;
}

function quotaLimitForScope(
  quotaScope: "anonymous_monthly" | "signed_in_monthly" | "entitled_monthly",
  isAuthenticated: boolean,
) {
  if (quotaScope === "entitled_monthly") {
    return ENTITLED_MONTHLY_QUOTA;
  }
  if (quotaScope === "signed_in_monthly" || isAuthenticated) {
    return AUTHENTICATED_MONTHLY_QUOTA;
  }
  return ANONYMOUS_MONTHLY_QUOTA;
}

function createMessage(role: "assistant" | "user", content: string): ArticleAssistantMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

function introMessage(article: PublicArticle, topicTags: string[]) {
  const topTopic = topicTags[0]?.toLowerCase();
  if (topTopic) {
    return `Mình có thể cùng bạn gỡ nhẹ bài "${article.title}" theo hướng ${topTopic}. Bạn cứ hỏi ngắn thôi, Miru sẽ trả lời gọn và thực tế.`;
  }
  return `Mình có thể cùng bạn tóm lại bài "${article.title}", gọi tên điều đang chạm tới bạn nhất, rồi gợi ý bước nhỏ tiếp theo.`;
}

function readStoredState(articleSlug: string): StoredArticleAiState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(articleSlug));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredArticleAiState> | null;
    if (!parsed || !Array.isArray(parsed.messages)) {
      return null;
    }

    return {
      messages: parsed.messages.filter(
        (message): message is ArticleAssistantMessage =>
          Boolean(
            message &&
              typeof message === "object" &&
              (message.role === "assistant" || message.role === "user") &&
              typeof message.id === "string" &&
              typeof message.content === "string",
          ),
      ),
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : null,
      sessionStarted: Boolean(parsed.sessionStarted),
    };
  } catch {
    return null;
  }
}

function writeStoredState(articleSlug: string, state: StoredArticleAiState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(articleSlug), JSON.stringify(state));
  } catch {
    // Ignore localStorage quota/privacy failures.
  }
}

export function ArticleAiCompanion({ article, topicTags }: ArticleAiCompanionProps) {
  const searchParams = useSearchParams();
  const promptSuggestions = buildAssistantPrompts(topicTags, article.title);
  const storedState = readStoredState(article.slug);

  const [messages, setMessages] = useState<ArticleAssistantMessage[]>(() =>
    storedState?.messages.length
      ? storedState.messages
      : [
          {
            id: `assistant-intro-${article.slug}`,
            role: "assistant",
            content: introMessage(article, topicTags),
          },
        ],
  );
  const [draft, setDraft] = useState(() => storedState?.draft || "");
  const [sessionId, setSessionId] = useState<string | null>(() => storedState?.sessionId || null);
  const [isSending, setIsSending] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(() => storedState?.sessionStarted || false);
  const [quota, setQuota] = useState(() => readAssistantQuota(article.slug));
  const appChatHref = `${APP_URL}/chat?entry=public-article&article=${encodeURIComponent(article.slug)}`;
  const quotaCopy = quota.isAuthenticated
    ? `Bạn đang ở chế độ người dùng Miru với ${quota.remaining}/${quota.limit} lượt còn lại trong tháng.`
    : `Bạn đang thử ở chế độ khách với ${quota.remaining}/${quota.limit} lượt trong tháng. Đăng nhập để mở thêm quota hỏi đáp.`;

  useEffect(() => {
    writeStoredState(article.slug, {
      messages,
      draft,
      sessionId,
      sessionStarted,
    });
  }, [article.slug, draft, messages, sessionId, sessionStarted]);

  useEffect(() => {
    if (searchParams.get("public_ai_resume") !== "1") {
      return;
    }

    let cancelled = false;

    async function resumeAfterLogin() {
      const session = await startArticleAssistantSession(article);
      if (cancelled) {
        return;
      }
      const nextLimit = quotaLimitForScope(session.quota_scope, session.is_authenticated);
      setSessionId((current) => current || session.session_id);
      setQuota({
        used: Math.max(0, nextLimit - session.remaining_quota),
        limit: nextLimit,
        remaining: session.remaining_quota,
        isAuthenticated: session.is_authenticated,
        quotaScope: session.quota_scope,
      });

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("public_ai_resume");
        window.history.replaceState({}, "", url.toString());
      }
    }

    void resumeAfterLogin();
    return () => {
      cancelled = true;
    };
  }, [article, searchParams]);

  async function handleSend(rawPrompt: string) {
    const prompt = rawPrompt.trim();
    if (!prompt || isSending) {
      return;
    }

    if (quota.remaining <= 0) {
      await trackPublicEvent({
        event_type: "article_ai_quota_exhausted",
        article_slug: article.slug,
        therapist_id: article.therapist_id || null,
        topic_tags: topicTags,
      });
      setMessages((current) => [
        ...current,
        createMessage(
          "assistant",
          quota.isAuthenticated
            ? "Quota tháng này đã chạm ngưỡng. Bạn có thể mở app để dùng quota từ gói Miru của mình."
            : "Bạn đã dùng hết lượt thử trong tháng. Đăng nhập để mở thêm quota và tiếp tục giữ mạch trao đổi.",
        ),
      ]);
      return;
    }

    const optimisticUserMessage = createMessage("user", prompt);
    setMessages((current) => [...current, optimisticUserMessage]);
    setDraft("");
    setIsSending(true);

    try {
      let activeSessionId = sessionId;

      if (!activeSessionId) {
        const session = await startArticleAssistantSession(article);
        activeSessionId = session.session_id;
        setSessionId(session.session_id);
        const nextLimit = quotaLimitForScope(session.quota_scope, session.is_authenticated);
        setQuota((current) => ({
          ...current,
          limit: nextLimit,
          remaining: session.remaining_quota,
          isAuthenticated: session.is_authenticated,
          quotaScope: session.quota_scope,
          used: Math.max(0, nextLimit - session.remaining_quota),
        }));
        setSessionStarted(true);
      }

      const response = await sendArticleAssistantMessage(article, prompt, topicTags, activeSessionId);
      setSessionId(response.session.session_id);
      const nextLimit = quotaLimitForScope(
        response.session.quota_scope,
        response.session.is_authenticated,
      );
      setQuota((current) => ({
        ...current,
        limit: nextLimit,
        remaining: response.session.remaining_quota,
        isAuthenticated: response.session.is_authenticated,
        quotaScope: response.session.quota_scope,
        used: Math.max(0, nextLimit - response.session.remaining_quota),
      }));

      if (response.reply) {
        setMessages((current) => [...current, createMessage("assistant", response.reply)]);
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="surface-card detail-section article-assistant-panel">
      <div className="section-head article-assistant-head">
        <div className="eyebrow">Miru trong bài viết</div>
        <h2 className="section-title article-assistant-title">Hỏi nhẹ ngay trong lúc đang đọc</h2>
        <p className="section-copy">
          Miru có thể tóm ý chính, gỡ giúp một bước nhỏ, hoặc chuyển bạn sang therapist phù hợp hơn với chủ đề này.
        </p>
      </div>

      <div className="article-assistant-quota">
        <strong>Quota tháng này</strong>
        <span>{quotaCopy}</span>
      </div>

      <div className="article-assistant-prompt-row">
        {promptSuggestions.map((item) => (
          <button
            key={item}
            type="button"
            className="article-assistant-prompt"
            onClick={() => {
              setDraft(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="article-assistant-thread" aria-live="polite">
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "assistant"
                ? "conversation-bubble conversation-bubble--ai article-assistant-bubble"
                : "conversation-bubble conversation-bubble--user article-assistant-bubble"
            }
          >
            {message.content}
          </div>
        ))}
      </div>

      <div className="article-assistant-composer">
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder="Ví dụ: Điều nào trong bài này đang dễ chạm tới mình nhất?"
          rows={4}
        />
        <div className="button-row article-assistant-actions">
          <button
            type="button"
            className="button-primary article-assistant-send"
            onClick={() => {
              void handleSend(draft);
            }}
            disabled={isSending}
          >
            {isSending ? "Miru đang trả lời..." : "Gửi câu hỏi"}
          </button>

          {quota.isAuthenticated ? (
            <TrackedPublicLink
              href={appChatHref}
              className="button-secondary"
              event={{
                event_type: "article_ai_login_prompt_clicked",
                article_slug: article.slug,
                therapist_id: article.therapist_id || null,
                topic_tags: topicTags,
                metadata: { mode: "authenticated_continue" },
              }}
            >
              Tiếp tục trong app
            </TrackedPublicLink>
          ) : (
            <PublicLoginUpliftLink
              returnTo={`${SITE_URL}/bai-viet/${encodeURIComponent(article.slug)}?public_ai_resume=1`}
              className="button-secondary"
              event={{
                event_type: "article_ai_login_prompt_clicked",
                article_slug: article.slug,
                therapist_id: article.therapist_id || null,
                topic_tags: topicTags,
                metadata: { mode: "login_uplift" },
              }}
            >
              Đăng nhập để mở thêm lượt
            </PublicLoginUpliftLink>
          )}
        </div>
      </div>

      <div className="article-assistant-footnote">
        Miru trong bài viết chỉ là lớp đồng hành nhẹ để giúp bạn hiểu chủ đề này rõ hơn, không thay thế hỗ trợ chuyên môn.
      </div>
    </section>
  );
}
