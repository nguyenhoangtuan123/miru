import { Compass, GitCommitHorizontal, Sparkles } from 'lucide-react';
import { repairMojibake } from '../../lib/text';
import type { TrajectorySummary } from '../../services/trajectory';

function formatUpdatedAt(value?: string | null) {
  if (!value) return 'Vừa được tạo';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Vừa được tạo';
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TrajectorySummaryCard({
  summary,
  isLoading,
  onOpenIntake,
  onOpenFeedback,
}: {
  summary: TrajectorySummary | null;
  isLoading: boolean;
  onOpenIntake: () => void;
  onOpenFeedback: () => void;
}) {
  return (
    <div className="glass-panel rounded-3xl border border-white/10 bg-gradient-to-br from-miru-primary/18 to-transparent p-6">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/60">
        <Sparkles size={14} className="text-miru-primary" />
        Chương hiện tại
      </div>

      {isLoading ? (
        <div className="text-sm text-white/55">
          Miru đang ghép các tín hiệu gần đây để phản chiếu lại cho bạn...
        </div>
      ) : summary ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold text-white">
                {repairMojibake(summary.chapter_title)}
              </h3>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">
                Cập nhật lúc {formatUpdatedAt(summary.updated_at)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/8 p-3 text-miru-primary">
              <Compass size={20} />
            </div>
          </div>

          <p className="mt-4 text-sm leading-7 text-white/72">
            {repairMojibake(summary.reflection_text)}
          </p>

          {summary.trend_summary ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/40">Điều Miru đang thấy</div>
              <div className="mt-2 text-sm leading-7 text-white/80">
                {repairMojibake(summary.trend_summary)}
              </div>
            </div>
          ) : null}

          {summary.what_changed ? (
            <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sky-100/80">
                <GitCommitHorizontal size={14} />
                Điều đã đổi từ lần trước
              </div>
              <div className="mt-2 text-sm leading-7 text-sky-50/90">
                {repairMojibake(summary.what_changed)}
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/40">Bước tiếp theo</div>
            <div className="mt-2 text-sm leading-7 text-white/80">
              {repairMojibake(summary.suggested_next_step)}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onOpenFeedback}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              {summary.feedback_pending ? 'Tiếp tục chỉnh cho Miru' : 'Miru hiểu chưa đúng'}
            </button>
            <button
              onClick={onOpenIntake}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-miru-primary/30 bg-miru-primary/15 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-miru-primary/20"
            >
              Cập nhật câu hỏi ban đầu
            </button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-2xl font-semibold text-white">Bắt đầu hiểu mình rõ hơn</h3>
          <p className="mt-3 text-sm leading-7 text-white/70">
            Miru chưa có đủ dữ liệu để phản chiếu một chương rõ ràng cho bạn. Chỉ cần vài câu trả
            lời ngắn hoặc một bài tự đánh giá là đủ để bắt đầu.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onOpenIntake}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white"
            >
              Bắt đầu ngay
            </button>
            <button
              onClick={onOpenFeedback}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Nói cho Miru biết thêm
            </button>
          </div>
        </>
      )}
    </div>
  );
}
