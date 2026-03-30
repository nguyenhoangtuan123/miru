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

const TOPIC_OPTIONS = [
    "Lo âu & stress",
    "Trầm cảm",
    "Mối quan hệ",
    "Sức khỏe tinh thần chung",
    "Phát triển bản thân",
    "Nuôi dạy con",
    "Công việc & sự nghiệp",
    "Khác",
];

export function CommunityQuestionForm() {
    const [stage, setStage] = useState<AuthStage>("anonymous");
    const [loginHref, setLoginHref] = useState(() => {
        const viewer = getViewerState();
        return buildPublicContentLoginUrl({
            returnTo: `${SITE_URL}/hoi-dap`,
            anonymousId: viewer.anonymous_id,
            sessionId: viewer.session_id,
        });
    });
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
        return subscribeToPublicAuth(refreshAuthState);
    }, [refreshAuthState]);

    const toggleTag = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
        );
    };

    const handleSubmit = async () => {
        const trimmedName = publicName.trim();
        const trimmedQuestion = questionText.trim();

        if (!trimmedName || !trimmedQuestion) return;

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
                    public_name: trimmedName,
                    question_text: trimmedQuestion,
                    topic_tags: selectedTags,
                    source: "community_hub",
                }),
            });

            if (res.ok) {
                setSubmitted(true);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.detail || "Chưa gửi được câu hỏi. Vui lòng thử lại.");
            }
        } catch {
            setError("Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Anonymous: prompt login ──
    if (stage === "anonymous") {
        return (
            <div className="surface-card" style={{ padding: 24, display: "grid", gap: 16 }}>
                <p className="section-copy">
                    Bạn cần đăng nhập để đặt câu hỏi. Miru sẽ quay lại trang này sau khi đăng nhập.
                </p>
                <div className="button-row">
                    <TrackedPublicLink
                        href={loginHref}
                        className="button-primary"
                        event={{
                            event_type: "community_hub_login_prompt",
                            metadata: { surface: "hoi_dap" },
                        }}
                    >
                        Đăng nhập để đặt câu hỏi
                    </TrackedPublicLink>
                </div>
            </div>
        );
    }

    // ── Therapist: redirect to write articles ──
    if (stage === "therapist") {
        return (
            <div className="surface-card" style={{ padding: 24, display: "grid", gap: 16 }}>
                <p className="section-copy">
                    Tính năng đặt câu hỏi dành cho thân chủ. Với tư cách therapist, bạn có thể viết bài
                    hoặc trả lời câu hỏi trong portal.
                </p>
                <div className="button-row">
                    <a href={`${APP_URL}/therapist/articles`} className="button-primary" style={{ textDecoration: "none" }}>
                        Viết bài
                    </a>
                </div>
            </div>
        );
    }

    // ── Submitted success ──
    if (submitted) {
        return (
            <div className="surface-card" style={{ padding: 24, display: "grid", gap: 16 }}>
                <div style={{ fontSize: 32, textAlign: "center" }}>✅</div>
                <h3 style={{ textAlign: "center", color: "var(--text)" }}>Câu hỏi đã được gửi!</h3>
                <p className="section-copy" style={{ textAlign: "center" }}>
                    Câu hỏi của bạn đang chờ đội ngũ Miru xem qua và điều hướng tới chuyên gia phù hợp.
                    Bạn sẽ nhận được thông báo khi có câu trả lời.
                </p>
                <div className="button-row" style={{ justifyContent: "center" }}>
                    <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                            setSubmitted(false);
                            setQuestionText("");
                            setSelectedTags([]);
                        }}
                    >
                        Đặt thêm câu hỏi
                    </button>
                    <Link href="/" className="button-secondary">
                        Về trang chủ
                    </Link>
                </div>
            </div>
        );
    }

    // ── Client: show question form ──
    return (
        <div className="surface-card" style={{ padding: 24, display: "grid", gap: 20 }}>
            <label style={{ display: "grid", gap: 8 }}>
                <strong style={{ color: "var(--text)" }}>Biệt danh công khai *</strong>
                <input
                    value={publicName}
                    onChange={(e) => setPublicName(e.target.value)}
                    placeholder="Ví dụ: Mây, An, hoặc tên bạn muốn hiển thị"
                    maxLength={42}
                    style={{ width: "100%" }}
                />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
                <strong style={{ color: "var(--text)" }}>Câu hỏi của bạn *</strong>
                <textarea
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Mô tả câu hỏi bạn muốn gửi tới đội ngũ Miru..."
                    rows={5}
                    style={{ width: "100%" }}
                />
            </label>

            <div style={{ display: "grid", gap: 8 }}>
                <strong style={{ color: "var(--text)" }}>Chủ đề (tùy chọn)</strong>
                <div className="chip-row" style={{ flexWrap: "wrap", gap: 8 }}>
                    {TOPIC_OPTIONS.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            className={`chip ${selectedTags.includes(tag) ? "is-active" : ""}`}
                            onClick={() => toggleTag(tag)}
                            style={{ cursor: "pointer" }}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="article-assistant-footnote" style={{ color: "var(--danger, #e53e3e)" }}>
                    {error}
                </div>
            )}

            <div className="button-row">
                <button
                    type="button"
                    className="button-primary"
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting || !publicName.trim() || !questionText.trim()}
                >
                    {isSubmitting ? "Đang gửi..." : "Gửi câu hỏi"}
                </button>
            </div>

            <div className="article-assistant-footnote">
                Câu hỏi sẽ hiển thị theo biệt danh công khai bạn chọn. Đội ngũ Miru sẽ xem xét và điều
                hướng tới chuyên gia phù hợp.
            </div>
        </div>
    );
}
