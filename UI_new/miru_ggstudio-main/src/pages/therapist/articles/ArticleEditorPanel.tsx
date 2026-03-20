import type { ReactNode } from 'react';
import type { Article, ArticleForm } from '../../../services/articles';
import { cleanArticleText, formatArticleDate, getArticleStatusMeta } from '../../articles/articleUtils';

type ArticleEditorPanelProps = {
  draft: ArticleForm;
  currentArticle: Article | null;
  onChange: <K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) => void;
  onSave: () => void;
  onSubmitReview: () => void;
  onArchive: () => void;
  saving: boolean;
  submitting: boolean;
  archiving: boolean;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-sm font-medium text-white/70">{children}</div>;
}

function TextField({
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
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
    />
  );
}

function TextAreaField({
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
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
    />
  );
}

export function ArticleEditorPanel({
  draft,
  currentArticle,
  onChange,
  onSave,
  onSubmitReview,
  onArchive,
  saving,
  submitting,
  archiving,
}: ArticleEditorPanelProps) {
  const meta = currentArticle ? getArticleStatusMeta(currentArticle.status) : null;
  const isLockedToReview = currentArticle?.status === 'pending_review' || currentArticle?.status === 'published';
  const isArchived = currentArticle?.status === 'archived';

  return (
    <section className="glass-panel rounded-[30px] border border-white/10 p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/35">Trình soạn</div>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {currentArticle ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">
            Tiêu đề, slug, tóm tắt và nội dung đều được lưu trong một bản nháp rõ ràng để chờ duyệt.
          </p>
        </div>

        {meta ? (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${meta.className}`}>
            <div>{meta.label}</div>
            <div className="mt-1 text-xs font-normal opacity-80">{meta.description}</div>
          </div>
        ) : null}
      </div>

      {isLockedToReview ? (
        <div className="mt-5 rounded-[24px] border border-amber-200/20 bg-amber-500/10 px-4 py-3 text-sm leading-7 text-amber-100">
          Bài này đang ở trạng thái {meta?.label?.toLowerCase()}. Nếu backend áp dụng rule đổi
          trạng thái sau khi lưu, nội dung chỉnh sửa mới có thể quay về nháp trước khi gửi duyệt lại.
        </div>
      ) : null}

      {isArchived ? (
        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-white/70">
          Bài đã được lưu trữ. Bạn vẫn có thể sửa nội dung và lưu nháp mới nếu backend cho phép.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>Tiêu đề</FieldLabel>
          <TextField
            value={draft.title}
            onChange={(value) => onChange('title', value)}
            placeholder="Ví dụ: 5 dấu hiệu bạn đang quá tải nhưng chưa nhận ra"
          />
        </div>

        <div>
          <FieldLabel>Slug</FieldLabel>
          <TextField
            value={draft.slug}
            onChange={(value) => onChange('slug', value)}
            placeholder="vi-du-bai-viet"
          />
        </div>
      </div>

      <div className="mt-4">
        <FieldLabel>Tóm tắt</FieldLabel>
        <TextAreaField
          value={draft.excerpt}
          onChange={(value) => onChange('excerpt', value)}
          placeholder="Viết 2-3 câu để giới thiệu nhanh nội dung bài viết..."
          rows={4}
        />
      </div>

      <div className="mt-4">
        <FieldLabel>URL ảnh cover</FieldLabel>
        <TextField
          value={draft.cover_image_url}
          onChange={(value) => onChange('cover_image_url', value)}
          placeholder="https://..."
        />
      </div>

      <div className="mt-4">
        <FieldLabel>Nội dung</FieldLabel>
        <TextAreaField
          value={draft.content_markdown}
          onChange={(value) => onChange('content_markdown', value)}
          placeholder="Viết nội dung ở Markdown. Có thể chia heading, bullet và các đoạn ngắn dễ đọc."
          rows={14}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <FieldLabel>SEO title</FieldLabel>
          <TextField
            value={draft.seo_title}
            onChange={(value) => onChange('seo_title', value)}
            placeholder="Tiêu đề tối ưu cho kết quả tìm kiếm"
          />
        </div>

        <div>
          <FieldLabel>SEO description</FieldLabel>
          <TextAreaField
            value={draft.seo_description}
            onChange={(value) => onChange('seo_description', value)}
            placeholder="Mô tả ngắn gọn, rõ ý, khoảng 1-2 câu."
            rows={4}
          />
        </div>
      </div>

      {currentArticle ? (
        <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/65 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-white/35">Đã sửa lần cuối</div>
            <div className="mt-1 font-medium text-white">{formatArticleDate(currentArticle.updated_at)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-white/35">Yêu cầu duyệt</div>
            <div className="mt-1 font-medium text-white">
              {formatArticleDate(currentArticle.review_requested_at, 'Chưa gửi duyệt')}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-white/35">Đăng công khai</div>
            <div className="mt-1 font-medium text-white">
              {formatArticleDate(currentArticle.published_at, 'Chưa đăng')}
            </div>
          </div>
        </div>
      ) : null}

      {currentArticle?.rejection_reason ? (
        <div className="mt-4 rounded-[24px] border border-red-200/20 bg-red-500/10 px-4 py-3 text-sm leading-7 text-red-100">
          <div className="mb-1 text-xs uppercase tracking-[0.25em] text-red-100/70">Lý do từ chối</div>
          {cleanArticleText(currentArticle.rejection_reason, 'Chưa có lý do bổ sung.')}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-miru-primary/85 disabled:opacity-60"
        >
          {saving ? 'Đang lưu...' : currentArticle ? 'Lưu thay đổi' : 'Lưu nháp'}
        </button>
        <button
          type="button"
          onClick={onSubmitReview}
          disabled={submitting || !currentArticle}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          {submitting ? 'Đang gửi...' : 'Gửi duyệt'}
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={archiving || !currentArticle}
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          {archiving ? 'Đang lưu trữ...' : 'Lưu trữ'}
        </button>
      </div>
    </section>
  );
}
