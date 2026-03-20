import type { PublicArticle, PublicTherapist } from "./types";

type TopicRule = {
  tag: string;
  keywords: string[];
};

const TOPIC_RULES: TopicRule[] = [
  { tag: "Lo âu", keywords: ["lo âu", "anxiety", "bồn chồn", "căng", "quá tải", "stress", "mindfulness", "thở"] },
  { tag: "Burnout", keywords: ["burnout", "kiệt sức", "mệt", "quá tải", "áp lực", "hết năng lượng"] },
  { tag: "Mối quan hệ", keywords: ["mối quan hệ", "tình yêu", "ranh giới", "xung đột", "gần gũi", "kết nối"] },
  { tag: "Tự chăm sóc", keywords: ["tự chăm sóc", "self-care", "ngủ", "nhịp", "phục hồi", "thói quen"] },
  { tag: "Tự ti", keywords: ["tự ti", "không đủ giỏi", "nghi ngờ", "imposter", "giá trị bản thân"] },
  { tag: "Mở lời", keywords: ["mở lời", "chia sẻ", "giữ một mình", "cô lập", "nhờ giúp đỡ"] },
];

function normalizeText(value: string) {
  return value.toLowerCase();
}

function buildArticleText(article: PublicArticle) {
  return normalizeText(
    [article.title, article.excerpt, article.content_markdown, article.seo_description, article.therapist_name]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join(" "),
  );
}

function buildTherapistText(therapist: PublicTherapist) {
  return normalizeText(
    [
      therapist.display_name,
      therapist.headline,
      therapist.bio,
      ...(therapist.specializations || []),
      ...(therapist.public_workflow_steps || []),
    ]
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join(" "),
  );
}

export function deriveArticleTopics(article: PublicArticle): string[] {
  const haystack = buildArticleText(article);
  const matches = TOPIC_RULES.filter((rule) => rule.keywords.some((keyword) => haystack.includes(keyword))).map(
    (rule) => rule.tag,
  );

  if (matches.length > 0) {
    return matches.slice(0, 3);
  }

  return ["Lắng nghe bản thân"];
}

function scoreArticleAgainstTopics(article: PublicArticle, topicTags: string[]) {
  if (topicTags.length === 0) {
    return 0;
  }
  const haystack = buildArticleText(article);
  let score = 0;
  for (const topic of topicTags) {
    const rule = TOPIC_RULES.find((item) => item.tag === topic);
    if (!rule) {
      continue;
    }
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      score += 2;
    }
    if (haystack.includes(normalizeText(topic))) {
      score += 1;
    }
  }
  return score;
}

function scoreTherapistAgainstTopics(therapist: PublicTherapist, topicTags: string[]) {
  if (topicTags.length === 0) {
    return 0;
  }
  const haystack = buildTherapistText(therapist);
  let score = 0;
  for (const topic of topicTags) {
    const rule = TOPIC_RULES.find((item) => item.tag === topic);
    if (!rule) {
      continue;
    }
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      score += 3;
    }
    if (haystack.includes(normalizeText(topic))) {
      score += 1;
    }
  }

  if (therapist.accepting_new_clients) {
    score += 2;
  }
  if (therapist.is_verified) {
    score += 1;
  }
  if (therapist.can_receive_contact_requests) {
    score += 1;
  }

  return score;
}

export function recommendRelatedArticles(currentArticle: PublicArticle, allArticles: PublicArticle[], limit = 3) {
  const topicTags = deriveArticleTopics(currentArticle);
  return allArticles
    .filter((article) => article.slug !== currentArticle.slug)
    .map((article) => ({
      article,
      score: scoreArticleAgainstTopics(article, topicTags),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.article);
}

export function recommendTherapistsByArticle(
  currentArticle: PublicArticle,
  therapists: PublicTherapist[],
  limit = 3,
) {
  const topicTags = deriveArticleTopics(currentArticle);
  return therapists
    .filter((therapist) => therapist.therapist_id !== currentArticle.therapist_id)
    .map((therapist) => ({
      therapist,
      score: scoreTherapistAgainstTopics(therapist, topicTags),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.therapist);
}

export function buildAssistantPrompts(topicTags: string[], articleTitle: string) {
  const basePrompts = [
    `Điều nào trong bài "${articleTitle}" dễ chạm tới mình nhất?`,
    "Nếu mình đang thấy quá tải, nên bắt đầu từ bước nhỏ nào trước?",
    "Miru có thể gợi ý therapist phù hợp với chủ đề này không?",
  ];

  if (topicTags.length === 0) {
    return basePrompts;
  }

  return [
    `Mình đang quan tâm nhiều tới ${topicTags[0].toLowerCase()}, Miru có thể tóm lại ý chính dễ làm theo không?`,
    `Nếu chủ đề "${topicTags[0]}" đang lặp lại gần đây, mình nên bắt đầu nói chuyện về nó như thế nào?`,
    ...basePrompts,
  ].slice(0, 4);
}
