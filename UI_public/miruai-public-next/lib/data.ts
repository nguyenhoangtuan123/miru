import { fetchApi, postApi } from "./api";
import { getViewerState } from "./public-events";
import {
  deriveArticleTopics,
  recommendRelatedArticles,
  recommendTherapistsByArticle,
} from "./topic-intent";
import type {
  ArticleQuestionSubmissionResponse,
  ArticleQuestionsResponse,
  PublicArticle,
  PublicArticleQuestion,
  PublicRecommendationResponse,
  PublicTherapist,
} from "./types";

type ArticlesResponse = {
  success?: boolean;
  articles?: unknown[];
};

type TherapistsResponse = {
  success?: boolean;
  therapists?: unknown[];
};

type ArticleResponse = {
  success?: boolean;
  article?: unknown;
};

type TherapistResponse = {
  success?: boolean;
  profile?: unknown;
};

const MOJIBAKE_PATTERN = /[\xc3\xc4\xc6][\x80-\xbf]|\xc3[\xa0-\xbf]|Ã|Ä|Æ|á»|â€|Â/;

function repairMojibake(value: string) {
  if (!value || !MOJIBAKE_PATTERN.test(value)) {
    return value;
  }

  // Try re-encoding as Latin-1 bytes and decoding as UTF-8
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (decoded && decoded.length <= value.length) {
      return decoded;
    }
  } catch {
    // fatal: true throws on invalid sequences — fall through
  }

  // Fallback: non-strict decode (replaces invalid sequences with U+FFFD)
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // Only accept if no replacement characters were introduced
    if (decoded && !decoded.includes("\ufffd") && decoded.length <= value.length) {
      return decoded;
    }
  } catch {
    // ignore
  }

  return value;
}

const fallbackTherapists: PublicTherapist[] = [
  {
    therapist_id: "demo-therapist-1",
    display_name: "ThS. Minh Anh",
    headline: "Đồng hành cùng bạn trong những giai đoạn quá tải và thu mình.",
    bio: "Miru kết nối bạn với những therapist có cách làm việc rõ ràng, nhịp hỗ trợ mềm và khả năng theo dõi tiến trình giữa các buổi.",
    specializations: ["Lo âu", "Mindfulness", "Mối quan hệ"],
    accepting_new_clients: true,
    service_mode: "both",
    starting_price_vnd: 350000,
    pricing_unit: "session",
    pricing_note: "Có thể linh hoạt theo hình thức đồng hành.",
    public_workflow_steps: ["Lắng nghe vấn đề chính", "Thống nhất mục tiêu", "Theo dõi tiến trình từng tuần"],
    can_receive_contact_requests: true,
    is_verified: true,
    contact_request_count: 18,
    pair_conversion_count: 7,
    profile_view_count: 124
  },
  {
    therapist_id: "demo-therapist-2",
    display_name: "Cử nhân Phương Uyên",
    headline: "Hỗ trợ bạn thiết lập nhịp tự chăm sóc và gọi tên cảm xúc rõ hơn.",
    bio: "Không gian hỗ trợ nhẹ nhàng, rõ ràng và tập trung vào việc giúp thân chủ mở lời an toàn hơn.",
    specializations: ["Tự chăm sóc", "Stress học tập", "Chuyển tiếp cuộc sống"],
    accepting_new_clients: true,
    service_mode: "free",
    starting_price_vnd: null,
    pricing_unit: "session",
    pricing_note: "Một số ca hỗ trợ miễn phí theo đợt.",
    public_workflow_steps: ["Check-in ban đầu", "Bài tập ngắn", "Theo dõi nhịp quay lại"],
    can_receive_contact_requests: true,
    is_verified: true,
    contact_request_count: 9,
    pair_conversion_count: 4,
    profile_view_count: 87
  },
  {
    therapist_id: "demo-therapist-3",
    display_name: "ThS. Đức Huy",
    headline: "Làm việc với vòng lặp suy nghĩ tiêu cực và cảm giác mất phương hướng.",
    bio: "Phù hợp với thân chủ muốn có thêm một điểm tựa người thật giữa các buổi trị liệu.",
    specializations: ["CBT", "Rumination", "Burnout"],
    accepting_new_clients: false,
    service_mode: "paid",
    starting_price_vnd: 450000,
    pricing_unit: "session",
    pricing_note: "Ưu tiên ca đã có lịch trị liệu ổn định.",
    public_workflow_steps: ["Đánh giá nhu cầu", "Chốt nhịp đồng hành", "Theo dõi giữa các buổi"],
    can_receive_contact_requests: true,
    is_verified: true,
    contact_request_count: 21,
    pair_conversion_count: 10,
    profile_view_count: 152
  }
];

const fallbackArticles: PublicArticle[] = [
  {
    id: "demo-article-1",
    therapist_id: "demo-therapist-1",
    therapist_name: "ThS. Minh Anh",
    title: "Nghệ thuật của sự hiện diện: Chữa lành qua mindfulness",
    slug: "nghe-thuat-cua-su-hien-dien-chua-lanh-qua-mindfulness",
    excerpt: "Một bài viết ngắn về cách quay trở lại hiện tại bằng những thực hành chậm, nhẹ và đủ gần với đời sống mỗi ngày.",
    content_markdown:
      "## Vì sao mindfulness hữu ích?\n\nKhi đầu óc bị kéo về tương lai hoặc mắc kẹt ở quá khứ, cơ thể rất dễ bước vào trạng thái căng cứng.\n\n- Thở chậm lại.\n- Gọi tên thứ mình đang cảm thấy.\n- Quay về với các giác quan.\n\nNhững bước nhỏ đó thường là điểm bắt đầu của cảm giác an toàn.",
    seo_title: "Nghệ thuật của sự hiện diện",
    seo_description: "Mindfulness như một cách đưa cơ thể và tâm trí quay lại hiện tại.",
    published_at: "2026-03-18T09:00:00+07:00",
    updated_at: "2026-03-18T09:00:00+07:00",
    therapist: {
      therapist_id: "demo-therapist-1",
      display_name: "ThS. Minh Anh",
      headline: "Đồng hành cùng bạn trong những giai đoạn quá tải và thu mình.",
      specializations: ["Lo âu", "Mindfulness"],
      is_verified: true
    }
  },
  {
    id: "demo-article-2",
    therapist_id: "demo-therapist-2",
    therapist_name: "Cử nhân Phương Uyên",
    title: "Thiết lập ranh giới lành mạnh trong tình yêu",
    slug: "thiet-lap-ranh-gioi-lanh-manh-trong-tinh-yeu",
    excerpt: "Ranh giới không làm bạn xa cách hơn; nó giúp mối quan hệ bớt mơ hồ và bớt làm bạn kiệt sức.",
    content_markdown:
      "## Ranh giới không phải từ chối yêu thương\n\nRanh giới là cách ta bảo vệ năng lượng và sự rõ ràng của mình.\n\n- Nói điều mình cần.\n- Gọi tên điều mình không thể tiếp tục chịu đựng.\n- Giữ sự nhất quán.",
    seo_title: "Thiết lập ranh giới lành mạnh",
    seo_description: "Một bài viết thực tế về ranh giới trong các mối quan hệ gần gũi.",
    published_at: "2026-03-16T10:30:00+07:00",
    updated_at: "2026-03-16T10:30:00+07:00",
    therapist: {
      therapist_id: "demo-therapist-2",
      display_name: "Cử nhân Phương Uyên",
      headline: "Hỗ trợ bạn thiết lập nhịp tự chăm sóc.",
      specializations: ["Mối quan hệ"],
      is_verified: true
    }
  },
  {
    id: "demo-article-3",
    therapist_id: "demo-therapist-3",
    therapist_name: "ThS. Đức Huy",
    title: "Vượt qua cảm giác mình không đủ giỏi",
    slug: "vuot-qua-cam-giac-minh-khong-du-gioi",
    excerpt: "Cảm giác không đủ giỏi thường không chỉ đến từ năng lực, mà còn từ cách ta đang tự nói với chính mình.",
    content_markdown:
      "## Khi tự nghi ngờ trở thành thói quen\n\nBạn không cần ép mình tự tin ngay lập tức.\n\nĐiều quan trọng hơn là nhìn ra giọng nói nào đang lặp lại trong đầu và học cách không để nó dẫn đường toàn bộ ngày của mình.",
    seo_title: "Vượt qua cảm giác mình không đủ giỏi",
    seo_description: "Một cách nhìn nhẹ hơn với hội chứng kẻ mạo danh và sự tự nghi ngờ.",
    published_at: "2026-03-14T08:15:00+07:00",
    updated_at: "2026-03-14T08:15:00+07:00",
    therapist: {
      therapist_id: "demo-therapist-3",
      display_name: "ThS. Đức Huy",
      headline: "Làm việc với vòng lặp suy nghĩ tiêu cực.",
      specializations: ["Burnout"],
      is_verified: true
    }
  }
];

const COMMUNITY_QUESTION_STORAGE_PREFIX = "miru_public_article_questions";

const fallbackArticleQuestions: Record<string, PublicArticleQuestion[]> = {
  "nghe-thuat-cua-su-hien-dien-chua-lanh-qua-mindfulness": [
    {
      question_id: "demo-question-1",
      article_slug: "nghe-thuat-cua-su-hien-dien-chua-lanh-qua-mindfulness",
      public_name: "Mây",
      question_text: "Làm sao để quay lại hiện tại khi đầu óc cứ chạy rất nhanh?",
      answer_text:
        "Miru gợi ý bắt đầu bằng một nhịp rất nhỏ: gọi tên 3 thứ đang nhìn thấy, 2 âm thanh đang nghe và 1 cảm giác trong cơ thể.",
      answer_by: "ThS. Minh Anh",
      answer_role: "therapist",
      status: "answered",
      created_at: "2026-03-18T10:00:00+07:00",
      answered_at: "2026-03-18T10:06:00+07:00",
      updated_at: "2026-03-18T10:06:00+07:00",
      published_at: "2026-03-18T10:06:00+07:00",
      topic_tags: ["Mindfulness", "Tự chăm sóc"],
      therapist_name: "ThS. Minh Anh",
    },
    {
      question_id: "demo-question-2",
      article_slug: "nghe-thuat-cua-su-hien-dien-chua-lanh-qua-mindfulness",
      public_name: "An",
      question_text: "Nếu mình rất khó ngồi yên thì có cần phải thiền lâu không?",
      answer_text:
        "Không cần. 1-2 phút quan sát hơi thở đều đặn còn hữu ích hơn một lần ép mình ngồi quá lâu.",
      answer_by: "Cử nhân Phương Uyên",
      answer_role: "therapist",
      status: "published",
      created_at: "2026-03-18T11:15:00+07:00",
      answered_at: "2026-03-18T11:32:00+07:00",
      updated_at: "2026-03-18T11:32:00+07:00",
      topic_tags: ["Mindfulness"],
      therapist_name: "Cử nhân Phương Uyên",
    },
  ],
  "thiet-lap-ranh-gioi-lanh-manh-trong-tinh-yeu": [
    {
      question_id: "demo-question-3",
      article_slug: "thiet-lap-ranh-gioi-lanh-manh-trong-tinh-yeu",
      public_name: "Linh",
      question_text: "Mình nói ranh giới mà đối phương thấy mình lạnh đi, vậy có sai không?",
      answer_text:
        "Ranh giới không làm tình cảm mất đi; thường là nó giúp hai bên nhìn rõ nhu cầu thật hơn.",
      answer_by: "Cử nhân Phương Uyên",
      answer_role: "therapist",
      status: "answered",
      created_at: "2026-03-16T12:20:00+07:00",
      answered_at: "2026-03-16T12:25:00+07:00",
      updated_at: "2026-03-16T12:25:00+07:00",
      published_at: "2026-03-16T12:25:00+07:00",
      topic_tags: ["Mối quan hệ", "Ranh giới"],
      therapist_name: "Cử nhân Phương Uyên",
    },
  ],
  "vuot-qua-cam-giac-minh-khong-du-gioi": [
    {
      question_id: "demo-question-4",
      article_slug: "vuot-qua-cam-giac-minh-khong-du-gioi",
      public_name: "Nhã",
      question_text: "Làm gì khi mình cứ so sánh bản thân với người khác mỗi ngày?",
      answer_text:
        "Thử chuyển câu hỏi từ 'mình có kém không' sang 'mình đang mệt ở điểm nào' để bớt tự đánh giá.",
      answer_by: "ThS. Đức Huy",
      answer_role: "therapist",
      status: "published",
      created_at: "2026-03-14T13:45:00+07:00",
      answered_at: "2026-03-14T13:52:00+07:00",
      updated_at: "2026-03-14T13:52:00+07:00",
      published_at: "2026-03-14T13:52:00+07:00",
      topic_tags: ["Burnout", "Tự đánh giá"],
      therapist_name: "ThS. Đức Huy",
    },
  ],
};

function questionStorageKey(articleSlug: string) {
  return `${COMMUNITY_QUESTION_STORAGE_PREFIX}:${articleSlug}`;
}

function readStoredQuestions(articleSlug: string) {
  if (typeof window === "undefined") {
    return [] as PublicArticleQuestion[];
  }

  try {
    const raw = window.localStorage.getItem(questionStorageKey(articleSlug));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeQuestion)
      .filter((item): item is PublicArticleQuestion => Boolean(item));
  } catch {
    return [];
  }
}

function writeStoredQuestions(articleSlug: string, questions: PublicArticleQuestion[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(questionStorageKey(articleSlug), JSON.stringify(questions));
  } catch {
    // Ignore privacy or quota failures.
  }
}

function mergeQuestions(
  articleSlug: string,
  questions: PublicArticleQuestion[],
  limit: number,
) {
  const stored = readStoredQuestions(articleSlug);
  const merged = [...questions, ...stored];
  const deduped = new Map<string, PublicArticleQuestion>();

  merged.forEach((question) => {
    deduped.set(question.question_id, question);
  });

  return Array.from(deduped.values())
    .filter((question) => question.article_slug === articleSlug)
    .sort((left, right) => {
      const leftTime = new Date(left.updated_at || left.answered_at || left.created_at).getTime();
      const rightTime = new Date(right.updated_at || right.answered_at || right.created_at).getTime();
      return rightTime - leftTime;
    })
    .slice(0, limit);
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? repairMojibake(value) : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeTherapist(raw: unknown): PublicTherapist | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const therapist = raw as Record<string, unknown>;
  const therapistId = asText(therapist.therapist_id);
  const displayName = asText(therapist.display_name);
  if (!therapistId || !displayName) {
    return null;
  }

  return {
    therapist_id: therapistId,
    display_name: displayName,
    headline: asText(therapist.headline) || null,
    bio: asText(therapist.bio) || null,
    specializations: Array.isArray(therapist.specializations)
      ? therapist.specializations
        .filter((item): item is string => typeof item === "string")
        .map((item) => asText(item))
      : [],
    avatar_image:
      therapist.avatar_image && typeof therapist.avatar_image === "object"
        ? (therapist.avatar_image as { url?: string | null })
        : null,
    accepting_new_clients: therapist.accepting_new_clients !== false,
    service_mode:
      therapist.service_mode === "free" ||
        therapist.service_mode === "paid" ||
        therapist.service_mode === "both"
        ? therapist.service_mode
        : "both",
    starting_price_vnd:
      typeof therapist.starting_price_vnd === "number"
        ? therapist.starting_price_vnd
        : null,
    pricing_unit:
      therapist.pricing_unit === "package" ||
        therapist.pricing_unit === "custom" ||
        therapist.pricing_unit === "session"
        ? therapist.pricing_unit
        : "session",
    pricing_note: asText(therapist.pricing_note) || null,
    public_workflow_steps: Array.isArray(therapist.public_workflow_steps)
      ? therapist.public_workflow_steps
        .filter((item): item is string => typeof item === "string")
        .map((item) => asText(item))
      : [],
    can_receive_contact_requests: therapist.can_receive_contact_requests === true,
    is_verified: therapist.is_verified === true,
    contact_request_count: asNumber(therapist.contact_request_count),
    pair_conversion_count: asNumber(therapist.pair_conversion_count),
    profile_view_count: asNumber(therapist.profile_view_count),
    contact_phone: asText(therapist.contact_phone) || null,
    contact_email: asText(therapist.contact_email) || null,
    contact_zalo_url: asText(therapist.contact_zalo_url) || null,
    contact_facebook_url: asText(therapist.contact_facebook_url) || null,
    contact_website_url: asText(therapist.contact_website_url) || null
  };
}

function normalizeArticle(raw: unknown): PublicArticle | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const article = raw as Record<string, unknown>;
  const title = asText(article.title);
  const slug = asText(article.slug);
  if (!title || !slug) {
    return null;
  }
  return {
    id:
      typeof article.id === "string" || typeof article.id === "number"
        ? article.id
        : slug,
    therapist_id: asText(article.therapist_id) || null,
    therapist_name: asText(article.therapist_name) || null,
    title,
    slug,
    excerpt: asText(article.excerpt) || null,
    cover_image_url: asText(article.cover_image_url) || null,
    content_markdown: asText(article.content_markdown) || null,
    topic_tags: Array.isArray(article.topic_tags)
      ? article.topic_tags
        .filter((item): item is string => typeof item === "string")
        .map((item) => asText(item))
      : [],
    seo_title: asText(article.seo_title) || null,
    seo_description: asText(article.seo_description) || null,
    published_at: asText(article.published_at) || null,
    updated_at: asText(article.updated_at) || null,
    therapist:
      article.therapist && typeof article.therapist === "object"
        ? (article.therapist as PublicArticle["therapist"])
        : null
  };
}

function normalizeQuestion(raw: unknown): PublicArticleQuestion | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const question = raw as Record<string, unknown>;
  const questionId = asText(question.question_id || question.id);
  const articleSlug = asText(question.article_slug);
  const publicName = asText(
    question.public_name || question.public_display_name || question.display_name || question.author_name
  );
  const questionText = asText(question.question_text || question.content || question.text);

  if (!questionId || !articleSlug || !publicName || !questionText) {
    return null;
  }

  return {
    question_id: questionId,
    article_slug: articleSlug,
    public_name: publicName,
    question_text: questionText,
    status: asText(question.status) || "published",
    created_at: asText(question.created_at) || new Date().toISOString(),
    updated_at: asText(question.updated_at) || null,
    answered_at: asText(question.answered_at) || null,
    published_at: asText(question.published_at) || null,
    hidden_at: asText(question.hidden_at) || null,
    answer_text: asText(question.answer_text) || null,
    answer_by: asText(question.answer_by) || null,
    answer_role: asText(question.answer_role) || null,
    topic_tags: Array.isArray(question.topic_tags)
      ? question.topic_tags
        .filter((item): item is string => typeof item === "string")
        .map((item) => asText(item))
      : [],
    therapist_id: asText(question.therapist_id) || null,
    therapist_name: asText(question.therapist_name) || null,
    source: asText(question.source) || null,
  };
}

const normalizedFallbackTherapists = fallbackTherapists
  .map(normalizeTherapist)
  .filter((item): item is PublicTherapist => Boolean(item));

const normalizedFallbackArticles = fallbackArticles
  .map(normalizeArticle)
  .filter((item): item is PublicArticle => Boolean(item));

export async function getPublicArticles(options?: { limit?: number; therapistId?: string }) {
  const params = new URLSearchParams();
  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (options?.therapistId) {
    params.set("therapist_id", options.therapistId);
  }
  const query = params.toString();
  const response = await fetchApi<ArticlesResponse>(`/api/articles${query ? `?${query}` : ""}`);
  const articles =
    response?.articles?.map(normalizeArticle).filter((item): item is PublicArticle => Boolean(item)) ||
    [];
  if (articles.length > 0) {
    return articles;
  }
  if (options?.therapistId) {
    return normalizedFallbackArticles.filter((item) => item.therapist_id === options.therapistId);
  }
  return normalizedFallbackArticles;
}

export async function getPublicArticle(slug: string) {
  const response = await fetchApi<ArticleResponse>(`/api/articles/${encodeURIComponent(slug)}`);
  const article = normalizeArticle(response?.article);
  return article || normalizedFallbackArticles.find((item) => item.slug === slug) || null;
}

export async function getPublicTherapists(limit?: number) {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  const response = await fetchApi<TherapistsResponse>(`/api/profiles/therapists/public${query}`);
  const therapists =
    response?.therapists
      ?.map(normalizeTherapist)
      .filter((item): item is PublicTherapist => Boolean(item)) || [];
  return therapists.length > 0 ? therapists : normalizedFallbackTherapists;
}

export async function getPublicTherapist(therapistId: string) {
  const response = await fetchApi<TherapistResponse>(
    `/api/profiles/therapists/public/${encodeURIComponent(therapistId)}`
  );
  const therapist = normalizeTherapist(response?.profile);
  return (
    therapist ||
    normalizedFallbackTherapists.find((item) => item.therapist_id === therapistId) ||
    null
  );
}

export async function getPublicArticleQuestions(articleSlug: string, limit = 6) {
  const viewer = getViewerState();
  const params = new URLSearchParams();
  params.set("article_slug", articleSlug);
  params.set("limit", String(limit));
  params.set("anonymous_id", viewer.anonymous_id);
  if (viewer.user_id) {
    params.set("user_id", viewer.user_id);
  }

  const response = await fetchApi<ArticleQuestionsResponse>(
    `/api/public/articles/${encodeURIComponent(articleSlug)}/questions?${params.toString()}`
  );
  const remoteQuestions = Array.isArray(response?.questions)
    ? response.questions
      .map(normalizeQuestion)
      .filter((item): item is PublicArticleQuestion => Boolean(item))
    : [];

  const fallbackQuestions = (fallbackArticleQuestions[articleSlug] || [])
    .map(normalizeQuestion)
    .filter((item): item is PublicArticleQuestion => Boolean(item));
  const questions = remoteQuestions.length > 0 ? remoteQuestions : fallbackQuestions;
  return mergeQuestions(articleSlug, questions, limit);
}

export async function submitPublicArticleQuestion(
  articleSlug: string,
  payload: {
    public_name: string;
    question_text: string;
    topic_tags?: string[];
  },
) {
  const viewer = getViewerState();
  const response = await postApi<ArticleQuestionSubmissionResponse>(
    `/api/public/articles/${encodeURIComponent(articleSlug)}/questions`,
    {
      anonymous_id: viewer.anonymous_id,
      session_id: viewer.session_id,
      user_id: viewer.user_id,
      public_display_name: payload.public_name,
      question_text: payload.question_text,
    },
  );

  const submittedQuestion =
    normalizeQuestion(response?.question) ||
    normalizeQuestion({
      question_id: `local-question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      article_slug: articleSlug,
      public_name: payload.public_name,
      question_text: payload.question_text,
      status: "pending_review",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      topic_tags: payload.topic_tags || [],
      source: "public_article",
    });

  if (submittedQuestion) {
    const existing = readStoredQuestions(articleSlug);
    const nextQuestions = [submittedQuestion, ...existing.filter((item) => item.question_id !== submittedQuestion.question_id)];
    writeStoredQuestions(articleSlug, nextQuestions);
  }

  return submittedQuestion;
}

function parseRecommendationArticlesResponse(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return { recommended_articles: [], reason_tags: [] as string[] };
  }
  const payload = raw as Record<string, unknown>;
  const items = Array.isArray(payload.recommended_articles)
    ? payload.recommended_articles
      .map(normalizeArticle)
      .filter((item): item is PublicArticle => Boolean(item))
    : [];
  const reasonTags = Array.isArray(payload.reason_tags)
    ? payload.reason_tags.filter((item): item is string => typeof item === "string")
    : [];
  return {
    recommended_articles: items,
    reason_tags: reasonTags,
  };
}

function parseRecommendationTherapistsResponse(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return { recommended_therapists: [], reason_tags: [] as string[] };
  }
  const payload = raw as Record<string, unknown>;
  const items = Array.isArray(payload.recommended_therapists)
    ? payload.recommended_therapists
      .map(normalizeTherapist)
      .filter((item): item is PublicTherapist => Boolean(item))
    : [];
  const reasonTags = Array.isArray(payload.reason_tags)
    ? payload.reason_tags.filter((item): item is string => typeof item === "string")
    : [];
  return {
    recommended_therapists: items,
    reason_tags: reasonTags,
  };
}

export async function getRecommendedPublicArticles(articleSlug: string, limit = 3) {
  const fallbackCurrentArticle = normalizedFallbackArticles.find((article) => article.slug === articleSlug);
  if (fallbackCurrentArticle) {
    return {
      recommended_articles: recommendRelatedArticles(fallbackCurrentArticle, normalizedFallbackArticles, limit),
      reason_tags: deriveArticleTopics(fallbackCurrentArticle),
    };
  }

  const viewer = getViewerState();
  const params = new URLSearchParams();
  params.set("article_slug", articleSlug);
  params.set("limit", String(limit));
  params.set("anonymous_id", viewer.anonymous_id);
  if (viewer.user_id) {
    params.set("user_id", viewer.user_id);
  }

  const response = await fetchApi<PublicRecommendationResponse<PublicArticle> & { recommended_articles?: unknown[] }>(
    `/api/public/recommendations/articles?${params.toString()}`
  );
  const parsed = parseRecommendationArticlesResponse(response);
  if (parsed.recommended_articles.length > 0 || parsed.reason_tags.length > 0) {
    return parsed;
  }

  const fallbackArticle = normalizedFallbackArticles.find((article) => article.slug === articleSlug);
  if (!fallbackArticle) {
    return parsed;
  }

  return {
    recommended_articles: recommendRelatedArticles(fallbackArticle, normalizedFallbackArticles, limit),
    reason_tags: deriveArticleTopics(fallbackArticle),
  };
}

export async function getRecommendedPublicTherapists(articleSlug: string, limit = 3) {
  const fallbackCurrentArticle = normalizedFallbackArticles.find((article) => article.slug === articleSlug);
  if (fallbackCurrentArticle) {
    return {
      recommended_therapists: recommendTherapistsByArticle(
        fallbackCurrentArticle,
        normalizedFallbackTherapists,
        limit,
      ),
      reason_tags: deriveArticleTopics(fallbackCurrentArticle),
    };
  }

  const viewer = getViewerState();
  const params = new URLSearchParams();
  params.set("article_slug", articleSlug);
  params.set("limit", String(limit));
  params.set("anonymous_id", viewer.anonymous_id);
  if (viewer.user_id) {
    params.set("user_id", viewer.user_id);
  }

  const response = await fetchApi<PublicRecommendationResponse<PublicTherapist> & { recommended_therapists?: unknown[] }>(
    `/api/public/recommendations/therapists?${params.toString()}`
  );
  const parsed = parseRecommendationTherapistsResponse(response);
  if (parsed.recommended_therapists.length > 0 || parsed.reason_tags.length > 0) {
    return parsed;
  }

  const fallbackArticle = normalizedFallbackArticles.find((article) => article.slug === articleSlug);
  if (!fallbackArticle) {
    return parsed;
  }

  return {
    recommended_therapists: recommendTherapistsByArticle(
      fallbackArticle,
      normalizedFallbackTherapists,
      limit,
    ),
    reason_tags: deriveArticleTopics(fallbackArticle),
  };
}

export { normalizedFallbackArticles as fallbackArticles, normalizedFallbackTherapists as fallbackTherapists };
