import { Eye, MessageSquareQuote, MousePointerClick, Sparkles, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Article, ArticleForm } from '../../../services/articles';
import { cleanArticleText, formatArticleDate } from '../../articles/articleUtils';
import { formatAnalyticsMetric, type TherapistArticleAnalytics } from './articleAnalytics';

type ArticleAnalyticsPanelProps = {
  article: Article | null;
  draft: ArticleForm;
  onChange: <K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) => void;
  analytics: TherapistArticleAnalytics | null;
  analyticsAvailable: boolean;
  loading?: boolean;
  error?: string | null;
};

function SideFieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">{children}</label>;
}

function SideInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 outline-none placeholder:text-white/20 focus:ring-2 focus:ring-miru-primary/40"
    />
  );
}

function SideTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-white/80 outline-none placeholder:text-white/20 focus:ring-2 focus:ring-miru-primary/40"
    />
  );
}

function AssistantCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-miru-primary">{title}</div>
      <p className="mt-3 text-sm leading-7 text-white/60">{body}</p>
    </div>
  );
}

function SignalCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.26em] text-white/40">{label}</span>
        <Icon size={16} className="text-miru-primary" />
      </div>
      <div className="mt-3 font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function deriveAssistantSummary(article: Article | null, draft: ArticleForm) {
  const excerpt = cleanArticleText(draft.excerpt);
  if (excerpt) return excerpt;

  const seo = cleanArticleText(draft.seo_description);
  if (seo) return seo;

  const content = cleanArticleText(draft.content_markdown)
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (content) {
    return `${content.slice(0, 180)}${content.length > 180 ? '…' : ''}`;
  }

  if (article?.status === 'published') {
    return 'Bài đã xuất bản. Hãy kiểm tra lại phần mở đầu, CTA riêng tư và các gợi ý therapist để tăng chuyển đổi.';
  }

  return 'Thêm tóm tắt ngắn ở đây để AI summary và thẻ bài viết trên Community có cùng một giọng điệu rõ ràng, dễ đọc.';
}

function deriveSuggestedTags(
  draft: ArticleForm,
  analytics: TherapistArticleAnalytics | null
): Array<{ label: string; count?: number }> {
  const seen = new Set<string>();
  const result: Array<{ label: string; count?: number }> = [];

  for (const topic of analytics?.topicTags ?? []) {
    const label = cleanArticleText(topic.label || topic.tag);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ label, count: topic.count });
    if (result.length >= 4) return result;
  }

  for (const tag of analytics?.reasonTags ?? []) {
    const label = cleanArticleText(tag);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ label });
    if (result.length >= 4) return result;
  }

  const fallbackText = `${draft.title} ${draft.excerpt}`
    .split(/[\s,.:;!?/\\|-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);

  for (const part of fallbackText) {
    const normalized = part.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ label: part });
    if (result.length >= 4) return result;
  }

  return [
    { label: 'Mental Health' },
    { label: 'Wellbeing' },
    { label: 'Therapist Insight' },
  ];
}

export function ArticleAnalyticsPanel({
  article,
  draft,
  onChange,
  analytics,
  analyticsAvailable,
  loading = false,
  error,
}: ArticleAnalyticsPanelProps) {
  const assistantSummary = deriveAssistantSummary(article, draft);
  const suggestedTags = deriveSuggestedTags(draft, analytics);
  const categoryLabel = suggestedTags[0]?.label ?? 'General';
  const hasMetrics = analyticsAvailable || Boolean(analytics?.hasMeaningfulData);

  return (
    <section className="overflow-hidden rounded-[32px] glass-panel border border-white/10">
      <div className="flex gap-2 border-b border-white/10 p-4">
        <button
          type="button"
          className="flex-1 rounded-[16px] bg-miru-primary/15 px-3 py-2 text-sm font-semibold text-miru-primary"
        >
          AI Assistant
        </button>
        <button
          type="button"
          className="flex-1 rounded-[16px] px-3 py-2 text-sm font-medium text-white/50 transition hover:bg-white/5"
        >
          Settings
        </button>
      </div>

      <div className="space-y-5 p-4">
        <AssistantCard title="AI Summary" body={assistantSummary} />

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">
            Quick prompts
          </div>
          <AssistantCard
            title="Mở đầu"
            body="Hãy làm rõ vấn đề người đọc đang mắc kẹt trong 2 đoạn đầu để tăng tỷ lệ đọc sâu và click sang hồ sơ therapist."
          />
          <AssistantCard
            title="CTA riêng tư"
            body="Kết bài nên có một nhịp chuyển mềm sang nhắn riêng therapist hoặc đăng ký trị liệu nếu người đọc cần hỗ trợ cá nhân hóa hơn."
          />
        </div>

        <div className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">
            Suggested tags
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedTags.map((tag) => (
              <div
                key={tag.label}
                className="rounded-full border border-miru-primary/30 bg-miru-primary/10 px-3 py-2 text-xs font-semibold text-miru-primary"
              >
                {tag.label}
                {typeof tag.count === 'number' ? ` · ${formatAnalyticsMetric(tag.count)}` : ''}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/3 p-4">
          <div className="space-y-2">
            <SideFieldLabel>Slug</SideFieldLabel>
            <SideInput
              value={draft.slug}
              onChange={(value) => onChange('slug', value)}
              placeholder="vi-du-bai-viet"
            />
          </div>

          <div className="space-y-2">
            <SideFieldLabel>Tóm tắt</SideFieldLabel>
            <SideTextarea
              value={draft.excerpt}
              onChange={(value) => onChange('excerpt', value)}
              placeholder="Viết 2-3 câu giới thiệu ngắn cho thẻ bài và AI summary..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <SideFieldLabel>Category</SideFieldLabel>
            <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
              {categoryLabel}
            </div>
          </div>

          <div className="space-y-2">
            <SideFieldLabel>URL ảnh cover</SideFieldLabel>
            <SideInput
              value={draft.cover_image_url}
              onChange={(value) => onChange('cover_image_url', value)}
              placeholder="https://..."
            />
            <div className="overflow-hidden rounded-[20px] border border-white/10">
              {draft.cover_image_url ? (
                <img
                  src={draft.cover_image_url}
                  alt="Ảnh cover bài viết"
                  className="aspect-[16/9] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-miru-primary/40 via-miru-primary/20 to-amber-500/20 text-sm text-white/50">
                  Cover preview
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <SideFieldLabel>SEO title</SideFieldLabel>
            <SideInput
              value={draft.seo_title}
              onChange={(value) => onChange('seo_title', value)}
              placeholder="Tiêu đề tối ưu tìm kiếm"
            />
          </div>

          <div className="space-y-2">
            <SideFieldLabel>SEO description</SideFieldLabel>
            <SideTextarea
              value={draft.seo_description}
              onChange={(value) => onChange('seo_description', value)}
              placeholder="Mô tả ngắn gọn để hiển thị khi chia sẻ hoặc tìm kiếm..."
              rows={4}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/35">
            Community signals
          </div>

          {error ? (
            <div className="rounded-[20px] border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/50">
              Đang tải tín hiệu community...
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <SignalCard icon={Eye} label="Lượt đọc" value={formatAnalyticsMetric(analytics?.viewCount ?? 0)} />
            <SignalCard
              icon={MousePointerClick}
              label="Click hồ sơ"
              value={formatAnalyticsMetric(analytics?.profileClickCount ?? 0)}
            />
            <SignalCard
              icon={MessageSquareQuote}
              label="Câu hỏi"
              value={formatAnalyticsMetric(analytics?.questionCount ?? 0)}
            />
            <SignalCard
              icon={Users}
              label="Liên hệ"
              value={formatAnalyticsMetric(analytics?.contactRequestCount ?? 0)}
            />
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
              <Sparkles size={16} className="text-miru-primary" />
              Trạng thái community
            </div>
            <div className="mt-3 space-y-2 text-sm leading-7 text-white/50">
              <div>
                Published:{' '}
                <span className="font-medium text-white/70">
                  {formatArticleDate(article?.published_at, 'Chưa đăng')}
                </span>
              </div>
              <div>
                Review requested:{' '}
                <span className="font-medium text-white/70">
                  {formatArticleDate(article?.review_requested_at, 'Chưa gửi duyệt')}
                </span>
              </div>
              <div>
                Theo dõi:{' '}
                <span className="font-medium text-white/70">
                  {hasMetrics ? 'Đã có tín hiệu community' : 'Chưa có nhiều dữ liệu đầu vào'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
