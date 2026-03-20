import { fetchApi } from "./api";
import { getViewerState } from "./public-events";
import {
  deriveArticleTopics,
  recommendRelatedArticles,
  recommendTherapistsByArticle,
} from "./topic-intent";
import type { PublicArticle, PublicTherapist, PublicRecommendationResponse } from "./types";

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

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
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
      ? therapist.specializations.filter((item): item is string => typeof item === "string")
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
      ? therapist.public_workflow_steps.filter((item): item is string => typeof item === "string")
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
      ? article.topic_tags.filter((item): item is string => typeof item === "string")
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
    return fallbackArticles.filter((item) => item.therapist_id === options.therapistId);
  }
  return fallbackArticles;
}

export async function getPublicArticle(slug: string) {
  const response = await fetchApi<ArticleResponse>(`/api/articles/${encodeURIComponent(slug)}`);
  const article = normalizeArticle(response?.article);
  return article || fallbackArticles.find((item) => item.slug === slug) || null;
}

export async function getPublicTherapists(limit?: number) {
  const query = typeof limit === "number" ? `?limit=${limit}` : "";
  const response = await fetchApi<TherapistsResponse>(`/api/profiles/therapists/public${query}`);
  const therapists =
    response?.therapists
      ?.map(normalizeTherapist)
      .filter((item): item is PublicTherapist => Boolean(item)) || [];
  return therapists.length > 0 ? therapists : fallbackTherapists;
}

export async function getPublicTherapist(therapistId: string) {
  const response = await fetchApi<TherapistResponse>(
    `/api/profiles/therapists/public/${encodeURIComponent(therapistId)}`
  );
  const therapist = normalizeTherapist(response?.profile);
  return (
    therapist ||
    fallbackTherapists.find((item) => item.therapist_id === therapistId) ||
    null
  );
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
  const fallbackCurrentArticle = fallbackArticles.find((article) => article.slug === articleSlug);
  if (fallbackCurrentArticle) {
    return {
      recommended_articles: recommendRelatedArticles(fallbackCurrentArticle, fallbackArticles, limit),
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

  const fallbackArticle = fallbackArticles.find((article) => article.slug === articleSlug);
  if (!fallbackArticle) {
    return parsed;
  }

  return {
    recommended_articles: recommendRelatedArticles(fallbackArticle, fallbackArticles, limit),
    reason_tags: deriveArticleTopics(fallbackArticle),
  };
}

export async function getRecommendedPublicTherapists(articleSlug: string, limit = 3) {
  const fallbackCurrentArticle = fallbackArticles.find((article) => article.slug === articleSlug);
  if (fallbackCurrentArticle) {
    return {
      recommended_therapists: recommendTherapistsByArticle(
        fallbackCurrentArticle,
        fallbackTherapists,
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

  const fallbackArticle = fallbackArticles.find((article) => article.slug === articleSlug);
  if (!fallbackArticle) {
    return parsed;
  }

  return {
    recommended_therapists: recommendTherapistsByArticle(
      fallbackArticle,
      fallbackTherapists,
      limit,
    ),
    reason_tags: deriveArticleTopics(fallbackArticle),
  };
}

export { fallbackArticles, fallbackTherapists };
