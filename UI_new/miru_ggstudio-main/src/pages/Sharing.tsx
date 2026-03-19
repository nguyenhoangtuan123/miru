import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { myTherapistSharingPreferencesQueryOptions, queryKeys } from '../queries/appQueries';
import {
  type SharingAccessLevel,
  type TherapistSharingPreference,
  updateMyTherapistSharingPreference,
} from '../services/therapistSharing';

const ACCESS_OPTIONS: Array<{
  value: SharingAccessLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'none',
    label: 'Không chia sẻ',
    description: 'Nhà trị liệu sẽ không xem được nhóm dữ liệu này.',
  },
  {
    value: 'ai_report',
    label: 'Chỉ báo cáo AI',
    description: 'Nhà trị liệu chỉ xem bản tóm tắt mức cao, không xem dữ liệu thô.',
  },
  {
    value: 'direct',
    label: 'Chia sẻ trực tiếp',
    description: 'Nhà trị liệu xem trực tiếp dữ liệu thuộc nhóm này.',
  },
];

const GROUPS: Array<{
  key: keyof Pick<
    TherapistSharingPreference,
    'ai_chat_access' | 'web_activity_access' | 'assessment_access' | 'insights_access'
  >;
  label: string;
  description: string;
}> = [
  {
    key: 'ai_chat_access',
    label: 'Chat với AI',
    description: 'Các phiên trò chuyện giữa bạn và AI Miru.',
  },
  {
    key: 'web_activity_access',
    label: 'Hoạt động trên web',
    description: 'Nhật ký, mục tiêu, mood/check-in, tiến độ bài tập và lịch hẹn.',
  },
  {
    key: 'assessment_access',
    label: 'Kết quả thang đo',
    description: 'Các bài đánh giá như PHQ-9, GAD-7, DASS-21 mà bạn đã làm.',
  },
  {
    key: 'insights_access',
    label: 'AI insights',
    description:
      'Các insight mức cao, bao gồm “Chương hiện tại”, xu hướng gần đây và gợi ý bước tiếp theo của Miru.',
  },
];

function PreferenceCard({
  preference,
  onChange,
  isSaving,
}: {
  preference: TherapistSharingPreference;
  onChange: (
    therapistId: string,
    field: keyof Pick<
      TherapistSharingPreference,
      'ai_chat_access' | 'web_activity_access' | 'assessment_access' | 'insights_access'
    >,
    value: SharingAccessLevel
  ) => void;
  isSaving: boolean;
}) {
  return (
    <div className="glass-panel p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-miru-primary/20 text-miru-primary">
          <UserCheck size={20} />
        </div>
        <div>
          <h2 className="text-xl font-semibold">
            {preference.therapist_name || preference.therapist_email || 'Nhà trị liệu'}
          </h2>
          <p className="text-sm text-white/55">
            Chọn mức chia sẻ riêng cho từng nhóm dữ liệu với therapist này.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {GROUPS.map((group) => (
          <div key={group.key} className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{group.label}</h3>
                <p className="mt-1 text-sm text-white/55">{group.description}</p>
              </div>
              <ShieldCheck size={18} className="shrink-0 text-emerald-300" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {ACCESS_OPTIONS.map((option) => {
                const selected = preference[group.key] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isSaving}
                    onClick={() => onChange(preference.therapist_id, group.key, option.value)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? 'border-miru-primary bg-miru-primary/15 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/8'
                    } disabled:opacity-60`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="mt-1 text-xs text-white/55">{option.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SharingPage() {
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery(myTherapistSharingPreferencesQueryOptions());

  const mutation = useMutation({
    mutationFn: ({
      therapistId,
      field,
      value,
    }: {
      therapistId: string;
      field: keyof Pick<
        TherapistSharingPreference,
        'ai_chat_access' | 'web_activity_access' | 'assessment_access' | 'insights_access'
      >;
      value: SharingAccessLevel;
    }) =>
      updateMyTherapistSharingPreference(therapistId, {
        [field]: value,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.therapistSharing.myPreferences() });
      queryClient.invalidateQueries({ queryKey: ['therapist-sharing', 'therapist'] });
    },
  });

  const preferences = useMemo(
    () => preferencesQuery.data?.preferences ?? [],
    [preferencesQuery.data?.preferences]
  );

  return (
    <div className="min-h-screen bg-miru-bg p-4 pb-24 md:p-8 md:pb-8">
      <div className="mx-auto max-w-5xl">
        <div className="glass-panel mb-8 p-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/45">
            <Sparkles size={14} />
            Chia sẻ dữ liệu trị liệu
          </div>
          <h1 className="text-3xl font-bold text-white">Kiểm soát dữ liệu bạn chia sẻ với therapist</h1>
          <p className="mt-3 max-w-3xl text-sm text-white/60">
            Bạn có thể chọn không chia sẻ, chỉ cho therapist xem báo cáo AI tổng quát, hoặc chia sẻ trực tiếp
            từng nhóm dữ liệu. Quyền mới sẽ có hiệu lực ngay ở lần truy cập tiếp theo.
          </p>
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/65">
            Mục <strong>AI insights</strong> có thể bao gồm “Chương hiện tại”, xu hướng gần đây và gợi ý
            bước tiếp theo mà Miru dùng để đồng hành cùng bạn. Miru không dùng ngôn ngữ chẩn đoán ở đây.
          </div>
        </div>

        {preferencesQuery.error instanceof Error ? (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {preferencesQuery.error.message}
          </div>
        ) : null}

        {preferencesQuery.isLoading ? (
          <div className="glass-panel p-8 text-sm text-white/60">
            Đang tải danh sách therapist đã kết nối...
          </div>
        ) : preferences.length === 0 ? (
          <div className="glass-panel p-8 text-sm text-white/60">
            Hiện chưa có therapist nào đang kết nối active với bạn, nên chưa có cài đặt chia sẻ để cấu hình.
          </div>
        ) : (
          <div className="space-y-6">
            {preferences.map((preference) => (
              <div key={preference.therapist_id}>
                <PreferenceCard
                  preference={preference}
                  isSaving={mutation.isPending}
                  onChange={(therapistId, field, value) => mutation.mutate({ therapistId, field, value })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
