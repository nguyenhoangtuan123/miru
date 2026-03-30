"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL, APP_URL, SITE_URL, buildPublicContentLoginUrl } from "../../lib/api";
import {
    getAuthStage,
    getPublicToken,
    subscribeToPublicAuth,
    type AuthStage,
} from "../../lib/public-auth";
import { getViewerState } from "../../lib/public-events";
import { TrackedPublicLink } from "./TrackedPublicLink";

/* ── Types ─────────────────────────────────────────────── */

type CommunityQuestion = {
    question_id: string;
    public_display_name: string;
    question_text: string;
    answer_text?: string | null;
    answer_by?: string | null;
    answer_role?: string;
    status: string;
    created_at: string;
    answered_at?: string | null;
};

const TOPIC_FILTERS = [
    "Tất cả",
    "Lo âu",
    "Trầm cảm",
    "Mối quan hệ",
    "Phát triển bản thân",
    "Công việc",
    "Nuôi dạy con",
];

const TOPIC_SUBMIT_OPTIONS = [
    "Lo âu & stress",
    "Trầm cảm",
    "Mối quan hệ",
    "Sức khỏe tinh thần",
    "Phát triển bản thân",
    "Nuôi dạy con",
    "Công việc & sự nghiệp",
    "Khác",
];

/* ── Helpers ───────────────────────────────────────────── */

function timeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "vừa xong";
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(isoDate).toLocaleDateString("vi-VN");
}

function initialAvatar(name: string): string {
    return (name || "M").charAt(0).toUpperCase();
}

/* ── Main Component ────────────────────────────────────── */

export function CommunityFeed() {
    const [stage, setStage] = useState<AuthStage>("anonymous");
    const [loginHref, setLoginHref] = useState(() => {
        const viewer = getViewerState();
        return buildPublicContentLoginUrl({
            returnTo: `${SITE_URL}/hoi-dap`,
            anonymousId: viewer.anonymous_id,
            sessionId: viewer.session_id,
        });
    });
    const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("Tất cả");

    // Composer state
    const [publicName, setPublicName] = useState("");
    const [questionText, setQuestionText] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refreshAuthState = useCallback(() => {
        const nextStage = getAuthStage();
        setStage(nextStage);

        if (nextStage === "anonymous") {
            const viewer = getViewerState();
            setLoginHref(
                buildPublicContentLoginUrl({
                    returnTo: `${SITE_URL}/hoi-dap`,
                    anonymousId: viewer.anonymous_id,
                    sessionId: viewer.session_id,
                }),
            );
        }
    }, []);

    useEffect(() => {
        refreshAuthState();
        fetchQuestions();
        return subscribeToPublicAuth(refreshAuthState);
    }, [refreshAuthState]);

    async function fetchQuestions() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/public/community/questions?limit=30`);
            if (res.ok) {
                const data = await res.json();
                setQuestions(data.questions || []);
            }
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }

    const toggleTag = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
        );
    };

    const handleSubmit = async () => {
        const name = publicName.trim();
        const text = questionText.trim();
        if (!name || !text) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const token = getPublicToken();
            const res = await fetch(`${API_BASE_URL}/api/public/community/questions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    public_name: name,
                    question_text: text,
                    topic_tags: selectedTags,
                    source: "community_hub",
                }),
            });

            if (res.ok) {
                setSubmitted(true);
                setQuestionText("");
                setSelectedTags([]);
                setTimeout(() => setSubmitted(false), 4000);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.detail || "Chưa gửi được câu hỏi.");
            }
        } catch {
            setError("Lỗi kết nối. Vui lòng thử lại.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="sanctuary-feed">
            <div className="sanctuary-grid">
                {/* ── Main Column ─────────────────────────── */}
                <div className="sanctuary-main">
                    {/* Composer */}
                    <section className="sanctuary-composer">
                        {stage === "anonymous" ? (
                            <div className="sanctuary-login-prompt">
                                <p>Đăng nhập để đặt câu hỏi cho cộng đồng Miru</p>
                                <TrackedPublicLink
                                    href={loginHref}
                                    className="sanctuary-btn-primary"
                                    event={{
                                        event_type: "community_hub_login_prompt",
                                        metadata: { surface: "hoi_dap_feed" },
                                    }}
                                >
                                    Đăng nhập
                                </TrackedPublicLink>
                            </div>
                        ) : stage === "therapist" ? (
                            <div className="sanctuary-login-prompt">
                                <p>Với tư cách therapist, bạn có thể viết bài hoặc trả lời câu hỏi trong portal.</p>
                                <a href={`${APP_URL}/therapist/articles`} className="sanctuary-btn-primary">
                                    Viết bài
                                </a>
                            </div>
                        ) : (
                            <>
                                <div className="sanctuary-composer-row">
                                    <div className="sanctuary-avatar">{initialAvatar(publicName)}</div>
                                    <div className="sanctuary-composer-fields">
                                        <input
                                            value={publicName}
                                            onChange={(e) => setPublicName(e.target.value)}
                                            placeholder="Biệt danh công khai"
                                            maxLength={42}
                                            className="sanctuary-input-ghost sanctuary-input-name"
                                        />
                                        <textarea
                                            value={questionText}
                                            onChange={(e) => setQuestionText(e.target.value)}
                                            placeholder="Chia sẻ suy nghĩ hoặc đặt câu hỏi..."
                                            rows={4}
                                            className="sanctuary-input-ghost sanctuary-textarea"
                                        />
                                        <div className="sanctuary-tag-row">
                                            {TOPIC_SUBMIT_OPTIONS.map((tag) => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    className={`sanctuary-tag ${selectedTags.includes(tag) ? "is-active" : ""}`}
                                                    onClick={() => toggleTag(tag)}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="sanctuary-composer-actions">
                                            {error && <span className="sanctuary-error">{error}</span>}
                                            {submitted && <span className="sanctuary-success">✓ Câu hỏi đã được gửi!</span>}
                                            <button
                                                type="button"
                                                className="sanctuary-btn-primary"
                                                onClick={() => void handleSubmit()}
                                                disabled={isSubmitting || !publicName.trim() || !questionText.trim()}
                                            >
                                                {isSubmitting ? "Đang gửi..." : "Đăng lên cộng đồng"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>

                    {/* Feed Filters */}
                    <div className="sanctuary-filters">
                        {TOPIC_FILTERS.map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                className={`sanctuary-filter-chip ${activeFilter === filter ? "is-active" : ""}`}
                                onClick={() => setActiveFilter(filter)}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    {/* Feed */}
                    <div className="sanctuary-posts">
                        {loading ? (
                            <div className="sanctuary-empty">Đang tải câu hỏi...</div>
                        ) : questions.length === 0 ? (
                            <div className="sanctuary-empty">
                                <p>Chưa có câu hỏi nào. Hãy là người đầu tiên đặt câu hỏi!</p>
                            </div>
                        ) : (
                            questions.map((q) => (
                                <article key={q.question_id} className="sanctuary-post">
                                    <div className="sanctuary-post-header">
                                        <div className="sanctuary-post-author">
                                            <div className="sanctuary-avatar-sm">
                                                {initialAvatar(q.public_display_name)}
                                            </div>
                                            <div>
                                                <p className="sanctuary-author-name">
                                                    {q.public_display_name || "Người dùng Miru"}
                                                </p>
                                                <p className="sanctuary-post-time">{timeAgo(q.created_at)}</p>
                                            </div>
                                        </div>
                                        {q.status === "answered" && (
                                            <span className="sanctuary-badge">Đã trả lời</span>
                                        )}
                                    </div>

                                    <div className="sanctuary-post-body">
                                        <p className="sanctuary-question-text">{q.question_text}</p>
                                    </div>

                                    {q.answer_text && (
                                        <div className="sanctuary-answer">
                                            <div className="sanctuary-answer-header">
                                                <span className="sanctuary-answer-icon">✦</span>
                                                <span className="sanctuary-answer-by">
                                                    {q.answer_by || "Therapist Miru"}
                                                </span>
                                            </div>
                                            <p className="sanctuary-answer-text">{q.answer_text}</p>
                                        </div>
                                    )}

                                    <div className="sanctuary-post-footer">
                                        <span className="sanctuary-post-status">
                                            {q.answer_text ? "Đã có phản hồi" : "Đang chờ phản hồi"}
                                        </span>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Sidebar ─────────────────────────────── */}
                <aside className="sanctuary-sidebar">
                    {/* About */}
                    <section className="sanctuary-sidebar-card">
                        <h4 className="sanctuary-sidebar-title">
                            <span className="sanctuary-icon">💬</span> Về Hỏi đáp Miru
                        </h4>
                        <p className="sanctuary-sidebar-copy">
                            Đặt câu hỏi công khai cho đội ngũ Miru. Therapist sẽ xem xét và trả lời những câu
                            hỏi có giá trị cho cộng đồng.
                        </p>
                        <p className="sanctuary-sidebar-copy" style={{ marginTop: 8 }}>
                            Đây không phải hỗ trợ tâm lý trực tiếp — nếu bạn cần đồng hành 1:1, hãy{" "}
                            <Link href="/danh-sach-therapist" className="sanctuary-link">
                                kết nối therapist
                            </Link>
                            .
                        </p>
                    </section>

                    {/* Trending Articles */}
                    <section className="sanctuary-sidebar-card sanctuary-sidebar-trending">
                        <h4 className="sanctuary-sidebar-title">
                            <span className="sanctuary-icon">📈</span> Bài viết nổi bật
                        </h4>
                        <div className="sanctuary-trending-list">
                            <a href={`${SITE_URL}/bai-viet`} className="sanctuary-trending-item">
                                <span className="sanctuary-trending-tag">#SứcKhỏeTinhThần</span>
                                <span className="sanctuary-trending-title">Khám phá bài viết từ therapist</span>
                            </a>
                        </div>
                    </section>

                    {/* Expert CTA */}
                    <section className="sanctuary-sidebar-expert">
                        <h4 className="sanctuary-sidebar-title-light">
                            <span className="sanctuary-icon">✦</span> Chuyên gia Miru
                        </h4>
                        <p className="sanctuary-expert-copy">
                            Câu hỏi hay sẽ được therapist Miru chọn và phản hồi chuyên sâu ngay trên trang này.
                        </p>
                        <Link href="/danh-sach-therapist" className="sanctuary-btn-expert">
                            Kết nối với therapist
                        </Link>
                    </section>
                </aside>
            </div>
        </main>
    );
}
