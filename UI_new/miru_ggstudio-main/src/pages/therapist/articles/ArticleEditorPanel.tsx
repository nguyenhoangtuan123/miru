import { Sparkles, ImagePlus, X, Upload } from 'lucide-react';
import { useRef, useState, useCallback } from 'react';
import type { Article, ArticleForm } from '../../../services/articles';
import { uploadArticleImage } from '../../../services/articles';
import { cleanArticleText, formatArticleDate, getArticleStatusMeta } from '../../articles/articleUtils';
import { RichTextEditor } from './RichTextEditor';
import './editor.css';

type ArticleEditorPanelProps = {
  draft: ArticleForm;
  currentArticle: Article | null;
  onChange: <K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) => void;
};

function countWords(value: string) {
  const normalized = value.trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}

function estimateReadingMinutes(content: string, excerpt: string) {
  const words = countWords(`${content} ${excerpt}`.trim());
  return Math.max(1, Math.round(words / 180));
}

/* ── Cover Image Upload ──────────────────────────────── */

function CoverImageUpload({
  url,
  onUpload,
  onRemove,
}: {
  url: string;
  onUpload: (url: string) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith('image/')) {
        setError('Chỉ chấp nhận file ảnh.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('File quá lớn. Giới hạn 5MB.');
        return;
      }
      setUploading(true);
      try {
        const publicUrl = await uploadArticleImage(file);
        onUpload(publicUrl);
      } catch {
        setError('Upload thất bại. Thử lại.');
      } finally {
        setUploading(false);
      }
    },
    [onUpload]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  if (url) {
    return (
      <div className="relative group rounded-2xl overflow-hidden border border-white/10">
        <img src={url} alt="Cover" className="w-full h-48 object-cover" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full bg-white/20 p-2 text-white hover:bg-white/30 transition"
            title="Thay ảnh"
          >
            <ImagePlus size={18} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full bg-red-500/60 p-2 text-white hover:bg-red-500/80 transition"
            title="Xoá ảnh bìa"
          >
            <X size={18} />
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center gap-2 py-10 ${dragOver ? 'border-miru-primary bg-miru-primary/5' : 'border-white/15 hover:border-white/30'
        }`}
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {uploading ? (
        <span className="text-sm text-white/50">Đang tải lên...</span>
      ) : (
        <>
          <Upload size={24} className="text-white/30" />
          <span className="text-sm text-white/50">
            Kéo thả hoặc click để chọn ảnh bìa
          </span>
          <span className="text-[11px] text-white/30">JPG, PNG, WebP — tối đa 5MB</span>
        </>
      )}
      {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  );
}

/* ── Main Component ──────────────────────────────────── */

export function ArticleEditorPanel({
  draft,
  currentArticle,
  onChange,
}: ArticleEditorPanelProps) {
  const statusMeta = currentArticle ? getArticleStatusMeta(currentArticle.status) : getArticleStatusMeta('draft');
  const readMinutes = estimateReadingMinutes(draft.content_markdown, draft.excerpt);
  const wordCount = countWords(draft.content_markdown);
  const characterCount = draft.content_markdown.trim().length;
  const lastSavedLabel = currentArticle
    ? formatArticleDate(currentArticle.updated_at, 'Chưa lưu')
    : 'Bản nháp mới';

  return (
    <section className="rounded-[32px] glass-panel border border-white/10">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-6 py-5 md:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/35">
              Sanctuary editor
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="font-['Plus_Jakarta_Sans'] text-[28px] font-bold tracking-tight text-white">
                {currentArticle ? 'Chỉnh sửa bài viết community' : 'Tạo bài viết community mới'}
              </h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-white/50">
            <span>{readMinutes} phút đọc</span>
            <span>Lưu gần nhất {lastSavedLabel}</span>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 md:px-8 md:py-10">
        {/* ─── Cover Image ─── */}
        <div className="mb-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/35">
            Ảnh bìa (thumbnail)
          </div>
          <CoverImageUpload
            url={draft.cover_image_url || ''}
            onUpload={(url) => onChange('cover_image_url', url)}
            onRemove={() => onChange('cover_image_url', '')}
          />
        </div>

        {/* Title input */}
        <input
          type="text"
          value={draft.title}
          onChange={(event) => onChange('title', event.target.value)}
          placeholder="Nhập tiêu đề bài viết..."
          className="w-full border-none bg-transparent p-0 font-['Plus_Jakarta_Sans'] text-4xl font-extrabold tracking-tight text-white outline-none placeholder:text-white/20 md:text-6xl"
        />

        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-white/50">
          <span>{readMinutes} phút đọc</span>
          <span>{wordCount} từ</span>
          <span>{statusMeta.description}</span>
        </div>

        {/* ─── WYSIWYG Editor ─── */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-white/35">
              Bản thảo chính
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-miru-primary/30 bg-miru-primary/10 px-3 py-1.5 text-xs font-semibold text-miru-primary transition hover:bg-miru-primary/20"
            >
              <Sparkles size={14} />
              Magic Edit
            </button>
          </div>

          <RichTextEditor
            content={draft.content_markdown}
            onChange={(markdown) => onChange('content_markdown', markdown)}
            placeholder="Hãy bắt đầu bằng vấn đề bạn muốn cộng đồng hiểu rõ hơn, sau đó dẫn dắt họ sang góc nhìn của therapist."
          />
        </div>

        {/* ─── Stats cards ─── */}
        <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Từ</div>
            <div className="mt-2 font-['Plus_Jakarta_Sans'] text-2xl font-bold text-white">{wordCount}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Ký tự</div>
            <div className="mt-2 font-['Plus_Jakarta_Sans'] text-2xl font-bold text-white">
              {characterCount}
            </div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
              Tín hiệu mở đầu
            </div>
            <div className="mt-2 text-sm leading-7 text-white/60">
              {cleanArticleText(
                draft.excerpt,
                'Thêm tóm tắt bên panel phải để bài có phần mở đầu rõ hơn trên Community.'
              )}
            </div>
          </div>
        </div>

        {/* ─── Article timestamps ─── */}
        {currentArticle ? (
          <div className="mt-6 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Đã sửa lần cuối
              </div>
              <div className="mt-2 font-medium text-white/70">
                {formatArticleDate(currentArticle.updated_at)}
              </div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Gửi duyệt
              </div>
              <div className="mt-2 font-medium text-white/70">
                {formatArticleDate(currentArticle.review_requested_at, 'Chưa gửi duyệt')}
              </div>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">
                Đăng công khai
              </div>
              <div className="mt-2 font-medium text-white/70">
                {formatArticleDate(currentArticle.published_at, 'Chưa đăng')}
              </div>
            </div>
          </div>
        ) : null}

        {/* ─── Rejection reason ─── */}
        {currentArticle?.rejection_reason ? (
          <div className="mt-6 rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm leading-7 text-rose-200">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-rose-400">
              Lý do từ chối
            </div>
            <div className="mt-2">
              {cleanArticleText(currentArticle.rejection_reason, 'Chưa có lý do bổ sung.')}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
