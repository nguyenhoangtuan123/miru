export function formatMoneyVnd(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "Liên hệ để trao đổi";
  }
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

export function formatDateVi(value?: string | null, fallback = "Đang cập nhật") {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatVietnameseDate(
  value?: string | null,
  fallback = "Đang cập nhật"
) {
  return formatDateVi(value, fallback);
}

export function estimateReadingMinutes(
  input?: string | { content_markdown?: string | null } | null
) {
  const text =
    typeof input === "string"
      ? input.trim()
      : (input?.content_markdown || "").trim();
  if (!text) {
    return 6;
  }
  const words = text.split(/\s+/).length;
  return Math.max(4, Math.round(words / 180));
}

export function trimText(value?: string | null, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const text = value.trim();
  return text || fallback;
}

export function matchSearch(text: string, query: string) {
  if (!query) {
    return true;
  }
  return text.toLowerCase().includes(query.toLowerCase().trim());
}

export function filterByKeyword<T>(
  items: T[],
  query: string,
  extractor: (item: T) => string
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }
  return items.filter((item) =>
    extractor(item).toLowerCase().includes(normalizedQuery)
  );
}

export function serviceModeLabel(mode?: string | null) {
  switch (mode) {
    case "free":
      return "Miễn phí";
    case "paid":
      return "Có phí";
    default:
      return "Miễn phí và có phí";
  }
}

export function formatPrice(value?: number | null, unit?: string | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "Trao đổi trực tiếp về mức phí";
  }
  const unitLabel =
    unit === "package" ? "gói" : unit === "custom" ? "thoả thuận" : "buổi";
  return `Từ ${formatMoneyVnd(value)} / ${unitLabel}`;
}
