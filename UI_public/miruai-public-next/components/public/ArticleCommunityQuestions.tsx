"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { APP_URL, SITE_URL } from "../../lib/api";
import { getPublicArticleQuestions, submitPublicArticleQuestion } from "../../lib/data";
import { formatVietnameseDate } from "../../lib/format";
import { getViewerState, trackPublicEvent } from "../../lib/public-events";
import type { PublicArticleQuestion } from "../../lib/types";
import { PublicLoginUpliftLink } from "./PublicLoginUpliftLink";
import { PublicTherapistActionLink } from "./PublicTherapistActionLink";
import { TrackedPublicLink } from "./TrackedPublicLink";

type ArticleCommunityQuestionsProps = {
  articleSlug: string;
  articleTitle: string;
  topicTags: string[];
  initialQuestions: PublicArticleQuestion[];
  therapistId?: string;
};

const QUESTION_DRAFT_KEY = "miru_public_article_question_draft";
const QUESTION_NAME_KEY = "miru_public_article_question_name";

function storageKey(prefix: string, articleSlug: string) {
  return `${prefix}:${articleSlug}`;
}

function readStoredText(key: string) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStoredText(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (value.trim()) {
      window.localStorage.setItem(key, value);
      return;
    }
    window.localStorage.removeItem(key);
  } catch {
    // Ignore localStorage quota/privacy failures.
  }
}

function dedupeQuestions(questions: PublicArticleQuestion[]) {
  const byId = new Map<string, PublicArticleQuestion>();
  questions.forEach((question) => {
    byId.set(question.question_id, question);
  });
  return Array.from(byId.values()).sort((left, right) => {
    const leftTime = new Date(left.updated_at || left.answered_at || left.created_at).getTime();
    const rightTime = new Date(right.updated_at || right.answered_at || right.created_at).getTime();
    return rightTime - leftTime;
  });
}

function answererLabel(question: PublicArticleQuestion) {
  if (question.answer_by?.trim()) {
    return question.answer_by.trim();
  }
  if (question.answer_role === "therapist") {
    return "Therapist";
  }
  return "";
}

export function ArticleCommunityQuestions({
  articleSlug,
  articleTitle,
  topicTags,
  initialQuestions,
  therapistId,
}: ArticleCommunityQuestionsProps) {
  const searchParams = useSearchParams();
  const viewer = getViewerState();
  const [questions, setQuestions] = useState(initialQuestions);
  const [publicName, setPublicName] = useState("");
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const startTrackedRef = useRef(false);

  const articleUrl = `${SITE_URL}/bai-viet/${encodeURIComponent(articleSlug)}`;
  const loginReturnTo = `${articleUrl}?public_question_resume=1`;
  const visibleQuestions = useMemo(
    () =>
      dedupeQuestions(questions).filter(
        (question) => question.status === "published" || question.status === "answered" || !question.status,
      ),
    [questions],
  );

  useEffect(() => {
    writeStoredText(storageKey(QUESTION_NAME_KEY, articleSlug), publicName);
  }, [articleSlug, publicName]);

  useEffect(() => {
    writeStoredText(storageKey(QUESTION_DRAFT_KEY, articleSlug), draft);
  }, [articleSlug, draft]);

  useEffect(() => {
    setPublicName(readStoredText(storageKey(QUESTION_NAME_KEY, articleSlug)));
    setDraft(readStoredText(storageKey(QUESTION_DRAFT_KEY, articleSlug)));
    startTrackedRef.current = false;
  }, [articleSlug]);

  useEffect(() => {
    if (searchParams.get("public_question_resume") !== "1") {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("public_question_resume");
    window.history.replaceState({}, "", url.toString());
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      const fetched = await getPublicArticleQuestions(articleSlug, 8);
      if (cancelled) {
        return;
      }

      setQuestions((current) => dedupeQuestions([...fetched, ...current]));
    }

    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [articleSlug]);

  function markQuestionStarted(source: string) {
    if (startTrackedRef.current) {
      return;
    }
    startTrackedRef.current = true;
    void trackPublicEvent({
      event_type: "community_question_started",
      article_slug: articleSlug,
      therapist_id: null,
      topic_tags: topicTags,
      metadata: {
        source,
        article_title: articleTitle,
        authenticated: viewer.is_authenticated,
      },
    });
  }

  async function handleSubmit() {
    const trimmedName = publicName.trim();
    const trimmedDraft = draft.trim();
    if (!viewer.is_authenticated || isSubmitting || !trimmedName || !trimmedDraft) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const submittedQuestion = await submitPublicArticleQuestion(articleSlug, {
        public_name: trimmedName,
        question_text: trimmedDraft,
        topic_tags: topicTags,
      });

      if (submittedQuestion) {
        setQuestions((current) => dedupeQuestions([submittedQuestion, ...current]));
        setDraft("");
        writeStoredText(storageKey(QUESTION_DRAFT_KEY, articleSlug), "");
        setStatusMessage("Câu hỏi đã được gửi và đang chờ therapist duyệt.");
      } else {
        setStatusMessage("Miru chưa lưu được câu hỏi. Bạn thử gửi lại nhé.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface-card detail-section article-assistant-panel">
      <div className="section-head article-assistant-head">
        <div className="eyebrow">Cộng đồng Miru</div>
        <h2 className="section-title article-assistant-title">Hỏi công khai dưới bài viết</h2>
        <p className="section-copy">
          Bạn có thể để lại câu hỏi với biệt danh công khai. Therapist tác giả sẽ xem qua,
          duyệt và trả lời ngay trong mạch bài viết này.
        </p>
      </div>

      {viewer.is_authenticated ? (
        <div className="article-assistant-composer">
          <label className="section-copy" style={{ display: "grid", gap: 8 }}>
            <strong style={{ color: "var(--text)" }}>Biệt danh công khai</strong>
            <input
              value={publicName}
              onChange={(event) => {
                setPublicName(event.target.value);
                markQuestionStarted("public_name");
              }}
              onFocus={() => {
                markQuestionStarted("public_name_focus");
              }}
              placeholder="Ví dụ: Mây, An, hoặc một tên bạn muốn hiển thị"
              maxLength={42}
            />
          </label>

          <label className="section-copy" style={{ display: "grid", gap: 8 }}>
            <strong style={{ color: "var(--text)" }}>Câu hỏi của bạn</strong>
            <textarea
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                markQuestionStarted("question_text");
              }}
              onFocus={() => {
                markQuestionStarted("question_text_focus");
              }}
              placeholder="Ví dụ: Điều nào trong bài này mình nên thử ngay hôm nay?"
              rows={4}
            />
          </label>

          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isSubmitting || !publicName.trim() || !draft.trim()}
            >
              {isSubmitting ? "Đang gửi câu hỏi..." : "Gửi câu hỏi công khai"}
            </button>
            <TrackedPublicLink
              href={`${APP_URL}/chat?entry=public-article&article=${encodeURIComponent(articleSlug)}`}
              className="button-secondary"
              event={{
                event_type: "article_to_app_login",
                article_slug: articleSlug,
                therapist_id: null,
                topic_tags: topicTags,
                metadata: { mode: "community_question_continue_in_app" },
              }}
            >
              Tiếp tục trong app
            </TrackedPublicLink>
          </div>

          <div className="article-assistant-footnote">
            Câu hỏi sẽ hiển thị theo biệt danh công khai bạn chọn. Therapist là người xuất bản câu trả lời công khai.
          </div>

          {statusMessage ? <div className="article-assistant-footnote">{statusMessage}</div> : null}
        </div>
      ) : (
        <div className="surface-card" style={{ padding: 20, background: "rgba(255,255,255,0.78)" }}>
          <p className="section-copy" style={{ marginBottom: 16 }}>
            Đăng nhập để hỏi công khai dưới bài viết này. Miru sẽ giữ mạch đọc của bạn và quay lại đúng bài viết sau khi đăng nhập.
          </p>
          <PublicLoginUpliftLink
            returnTo={loginReturnTo}
            className="button-primary"
            event={{
              event_type: "article_to_app_login",
              article_slug: articleSlug,
              therapist_id: null,
              topic_tags: topicTags,
              metadata: { mode: "community_question_login" },
            }}
          >
            Đăng nhập để đặt câu hỏi
          </PublicLoginUpliftLink>
        </div>
      )}

      <div className="article-assistant-thread" aria-live="polite">
        {visibleQuestions.length > 0 ? (
          visibleQuestions.map((question) => {
            const hasAnswer = Boolean(question.answer_text);
            const answerLabel = answererLabel(question);

            return (
              <div
                key={question.question_id}
                className="surface-card"
                style={{
                  padding: 18,
                  display: "grid",
                  gap: 14,
                  background: "rgba(255,255,255,0.88)",
                }}
              >
                <div className="chip-row">
                  <span className="chip is-active">
                    {question.public_display_name || question.public_name || "Người dùng Miru"}
                  </span>
                  <span className="chip">{formatVietnameseDate(question.created_at)}</span>
                  {hasAnswer ? <span className="chip">Đã trả lời</span> : <span className="chip">Đang chờ duyệt</span>}
                  {answerLabel ? <span className="chip">{answerLabel}</span> : null}
                </div>

                <div className="conversation-bubble conversation-bubble--user article-assistant-bubble">
                  {question.question_text}
                </div>

                {hasAnswer ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    <div className="conversation-bubble conversation-bubble--ai article-assistant-bubble">
                      {question.answer_text}
                    </div>
                    {therapistId ? (
                      <div className="button-row">
                        <PublicTherapistActionLink
                          therapistId={therapistId}
                          source="article"
                          sourceArticleSlug={articleSlug}
                          entryIntent="message"
                          returnTo={articleUrl}
                          className="button-secondary"
                          event={{
                            event_type: "article_to_contact_request",
                            article_slug: articleSlug,
                            therapist_id: therapistId,
                            topic_tags: topicTags,
                            metadata: {
                              source: "community_answer_followup",
                              question_id: question.question_id,
                              entry_intent: "message",
                            },
                          }}
                        >
                          Muốn hỏi riêng về trường hợp của bạn?
                        </PublicTherapistActionLink>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="article-assistant-footnote">
                    Câu hỏi này đang chờ therapist xem qua và xuất bản câu trả lời công khai.
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="surface-card" style={{ padding: 20, color: "var(--muted)" }}>
            Chưa có câu hỏi công khai nào dưới bài này. Bạn có thể là người mở đầu cuộc trò chuyện.
          </div>
        )}
      </div>
    </section>
  );
}
