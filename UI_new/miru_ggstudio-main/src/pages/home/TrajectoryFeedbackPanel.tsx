import { useState } from 'react';
import { LoaderCircle, MessageSquareWarning, X } from 'lucide-react';
import { repairMojibake } from '../../lib/text';
import type { TrajectoryFeedbackPayload, TrajectorySummary } from '../../services/trajectory';

const FEEDBACK_OPTIONS: Array<{
  value: TrajectoryFeedbackPayload['feedback_type'];
  label: string;
  description: string;
}> = [
  {
    value: 'not_me',
    label: 'Chưa đúng với mình',
    description: 'Phản chiếu hiện tại không giống cách mình đang trải qua gần đây.',
  },
  {
    value: 'too_strong',
    label: 'Diễn giải hơi mạnh',
    description: 'Miru đang nói quá nặng hoặc quá chắc về trạng thái của mình.',
  },
  {
    value: 'missing_context',
    label: 'Thiếu bối cảnh',
    description: 'Miru đang thiếu vài chi tiết quan trọng nên chưa hiểu đúng tình hình.',
  },
  {
    value: 'want_other_direction',
    label: 'Muốn hướng hỗ trợ khác',
    description: 'Mình muốn Miru gợi ý theo một hướng khác phù hợp hơn.',
  },
];

export function TrajectoryFeedbackPanel({
  open,
  summary,
  isSaving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  summary: TrajectorySummary | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (payload: TrajectoryFeedbackPayload) => Promise<void>;
}) {
  const [feedbackType, setFeedbackType] = useState<TrajectoryFeedbackPayload['feedback_type']>('not_me');
  const [note, setNote] = useState('');

  if (!open) {
    return null;
  }

  const selectedOption = FEEDBACK_OPTIONS.find((option) => option.value === feedbackType);

  async function handleSubmit() {
    await onSubmit({
      feedback_type: feedbackType,
      note: note.trim() || undefined,
    });
    setNote('');
    setFeedbackType('not_me');
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm md:items-center">
      <div className="glass-panel w-full max-w-2xl rounded-[32px] border border-white/10 p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/55">
              <MessageSquareWarning size={14} className="text-miru-primary" />
              Điều chỉnh phản chiếu
            </div>
            <h3 className="mt-4 text-2xl font-semibold text-white">Miru hiểu chưa đúng ở chỗ nào?</h3>
            <p className="mt-2 text-sm leading-7 text-white/65">
              Miru sẽ dùng phản hồi này để diễn giải nhẹ hơn và sát với bạn hơn ở lần cập nhật tiếp theo.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {summary ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-black/15 px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Chương hiện tại</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {repairMojibake(summary.chapter_title)}
            </div>
            <div className="mt-2 text-sm leading-7 text-white/65">
              {repairMojibake(summary.reflection_text)}
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          {FEEDBACK_OPTIONS.map((option) => {
            const selected = option.value === feedbackType;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFeedbackType(option.value)}
                className={`rounded-3xl border px-4 py-4 text-left transition-colors ${
                  selected
                    ? 'border-miru-primary/55 bg-miru-primary/15 text-white'
                    : 'border-white/10 bg-white/5 text-white/72 hover:bg-white/8'
                }`}
              >
                <div className="font-semibold">{option.label}</div>
                <div className="mt-1 text-sm leading-7 text-white/60">{option.description}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <div className="text-sm font-medium text-white">Ghi chú thêm cho Miru</div>
          <div className="mt-1 text-sm text-white/55">
            {selectedOption?.description ?? 'Bạn có thể nói thêm để Miru hiểu sát hơn.'}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ví dụ: Mình đang mệt nhưng không hẳn là thu mình, chỉ là tuần này nhiều việc quá."
            className="mt-3 h-28 w-full resize-none rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/30 focus:border-miru-primary/45 focus:outline-none"
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/72 transition-colors hover:bg-white/10 hover:text-white"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? <LoaderCircle size={16} className="animate-spin" /> : null}
            {isSaving ? 'Đang gửi phản hồi...' : 'Gửi phản hồi cho Miru'}
          </button>
        </div>
      </div>
    </div>
  );
}
