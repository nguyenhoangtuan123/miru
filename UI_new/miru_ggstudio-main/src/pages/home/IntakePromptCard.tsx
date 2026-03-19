import { useEffect, useState } from 'react';
import { LoaderCircle, MessageCircleHeart, Save } from 'lucide-react';
import type { UserIntakeProfile } from '../../services/intake';

const PRIMARY_REASON_OPTIONS = [
  { value: 'stress', label: 'Áp lực và căng thẳng' },
  { value: 'anxiety', label: 'Lo âu' },
  { value: 'sadness', label: 'Buồn và hụt năng lượng' },
  { value: 'loneliness', label: 'Cô đơn' },
  { value: 'burnout', label: 'Kiệt sức' },
  { value: 'relationship', label: 'Khó khăn trong mối quan hệ' },
  { value: 'self_understanding', label: 'Muốn hiểu mình hơn' },
  { value: 'other', label: 'Khác' },
];

const OVERWHELM_OPTIONS = [
  { value: 'low', label: 'Khá nhẹ' },
  { value: 'medium', label: 'Vừa phải' },
  { value: 'high', label: 'Khá nặng' },
];

const SUPPORT_STYLE_OPTIONS = [
  { value: 'keep_inside', label: 'Thường giữ một mình' },
  { value: 'mixed', label: 'Lúc giữ một mình, lúc tìm hỗ trợ' },
  { value: 'reach_out', label: 'Hay tìm người để chia sẻ' },
];

const HELP_FOCUS_OPTIONS = [
  { value: 'calm_down', label: 'Bình tĩnh lại và ổn định cảm xúc' },
  { value: 'understand_patterns', label: 'Hiểu các mẫu lặp cảm xúc' },
  { value: 'build_routine', label: 'Xây lại nhịp sinh hoạt' },
  { value: 'express_feelings', label: 'Nói ra cảm xúc dễ hơn' },
  { value: 'connect_therapist', label: 'Kết nối therapist phù hợp' },
  { value: 'gentle_checkins', label: 'Nhận nhắc nhở nhẹ nhàng từ Miru' },
];

type IntakeDraft = {
  primary_reason: string;
  overwhelm_level: string;
  support_style: string;
  desired_help_focus: string;
  wants_therapist_connection: boolean;
  memory_note: string;
};

function createDraft(profile: UserIntakeProfile | null): IntakeDraft {
  return {
    primary_reason: profile?.primary_reason ?? '',
    overwhelm_level: profile?.overwhelm_level ?? '',
    support_style: profile?.support_style ?? '',
    desired_help_focus: profile?.desired_help_focus ?? '',
    wants_therapist_connection: Boolean(profile?.wants_therapist_connection),
    memory_note: profile?.memory_note ?? '',
  };
}

export function IntakePromptCard({
  profile,
  isLoading,
  isExpanded,
  isSaving,
  onExpand,
  onCollapse,
  onSave,
}: {
  profile: UserIntakeProfile | null;
  isLoading: boolean;
  isExpanded: boolean;
  isSaving: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onSave: (payload: IntakeDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<IntakeDraft>(() => createDraft(profile));

  useEffect(() => {
    setDraft(createDraft(profile));
  }, [profile, isExpanded]);

  const completed = Boolean(profile?.completed_at);

  return (
    <div className="glass-panel rounded-3xl border border-white/10 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/55">
            <MessageCircleHeart size={14} className="text-miru-primary" />
            Câu hỏi ban đầu
          </div>
          <h3 className="text-2xl font-semibold text-white">
            {completed ? 'Cập nhật điều Miru nên biết về bạn' : 'Giúp Miru hiểu bạn tốt hơn'}
          </h3>
          <p className="mt-3 text-sm leading-7 text-white/65">
            Bộ câu hỏi này rất ngắn. Nó giúp Miru phản chiếu đúng hơn, không nhằm chẩn đoán hay
            đóng khung bạn.
          </p>
        </div>

        {!isExpanded ? (
          <button
            onClick={onExpand}
            className="rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white"
          >
            {completed ? 'Chỉnh lại' : 'Trả lời ngay'}
          </button>
        ) : null}
      </div>

      {isLoading && !isExpanded ? (
        <div className="mt-4 text-sm text-white/50">Đang tải hồ sơ ban đầu...</div>
      ) : null}

      {!isExpanded && completed ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-white/70">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Lý do chính</div>
            <div className="mt-2 font-medium text-white">
              {PRIMARY_REASON_OPTIONS.find((item) => item.value === profile?.primary_reason)?.label ??
                'Đã có dữ liệu'}
            </div>
          </div>
          <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-white/70">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Mức quá tải</div>
            <div className="mt-2 font-medium text-white">
              {OVERWHELM_OPTIONS.find((item) => item.value === profile?.overwhelm_level)?.label ??
                'Đã có dữ liệu'}
            </div>
          </div>
        </div>
      ) : null}

      {isExpanded ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-white/70">
              <span>Lý do chính bạn tìm đến Miru lúc này</span>
              <select
                value={draft.primary_reason}
                onChange={(event) => setDraft((prev) => ({ ...prev, primary_reason: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-miru-primary/45"
              >
                <option value="">Chọn một lý do</option>
                {PRIMARY_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-white/70">
              <span>Mức quá tải gần đây</span>
              <select
                value={draft.overwhelm_level}
                onChange={(event) => setDraft((prev) => ({ ...prev, overwhelm_level: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-miru-primary/45"
              >
                <option value="">Chọn một mức</option>
                {OVERWHELM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-white/70">
              <span>Khi khó khăn bạn thường làm gì</span>
              <select
                value={draft.support_style}
                onChange={(event) => setDraft((prev) => ({ ...prev, support_style: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-miru-primary/45"
              >
                <option value="">Chọn một xu hướng</option>
                {SUPPORT_STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-white/70">
              <span>Bạn đang muốn Miru giúp điều gì nhất</span>
              <select
                value={draft.desired_help_focus}
                onChange={(event) => setDraft((prev) => ({ ...prev, desired_help_focus: event.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-colors focus:border-miru-primary/45"
              >
                <option value="">Chọn một hướng</option>
                {HELP_FOCUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={draft.wants_therapist_connection}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, wants_therapist_connection: event.target.checked }))
              }
              className="h-4 w-4 rounded border-white/20 bg-transparent text-miru-primary"
            />
            Tôi muốn Miru gợi ý thêm khả năng kết nối therapist nếu thấy phù hợp.
          </label>

          <label className="space-y-2 text-sm text-white/70">
            <span>Điều Miru nên nhớ về bạn (tùy chọn)</span>
            <textarea
              value={draft.memory_note}
              onChange={(event) => setDraft((prev) => ({ ...prev, memory_note: event.target.value }))}
              rows={4}
              placeholder="Ví dụ: Tôi thường im lặng khi thấy quá tải, nhưng thực ra rất cần một điểm tựa dịu dàng."
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition-colors focus:border-miru-primary/45"
            />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={onCollapse}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/75 transition-colors hover:bg-white/10"
            >
              Để sau
            </button>
            <button
              onClick={() => void onSave(draft)}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ ban đầu'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
