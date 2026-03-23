import { CheckCircle2 } from 'lucide-react';
import type { TherapistPublicProfileForm } from '../../../services/profiles';

type ChecklistItem = {
  label: string;
  done: boolean;
};

type Props = {
  checklist: ChecklistItem[];
  checklistPercent: number;
  profileForm: TherapistPublicProfileForm | null;
  savingProfile: boolean;
  setProfileField: <K extends keyof TherapistPublicProfileForm>(
    key: K,
    value: TherapistPublicProfileForm[K]
  ) => void;
  onSaveProfile: () => void;
};

export function ProfileChecklistCard({
  checklist,
  checklistPercent,
  profileForm,
  savingProfile,
  setProfileField,
  onSaveProfile,
}: Props) {
  return (
    <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Checklist tăng chuyển đổi Community
        </h2>
        <span className="rounded-full bg-miru-primary/10 px-3 py-1 text-sm font-semibold text-miru-primary">
          {checklistPercent}%
        </span>
      </div>
      <div className="space-y-3">
        {checklist.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5"
          >
            <span className="text-slate-700 dark:text-white/75">{item.label}</span>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                item.done
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
              }`}
            >
              <CheckCircle2 size={14} />
              {item.done ? 'Đã có' : 'Cần bổ sung'}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <button
          onClick={() => setProfileField('is_public', !profileForm?.is_public)}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          {profileForm?.is_public ? 'Đang công khai' : 'Bật lên danh bạ'}
        </button>
        <button
          onClick={() =>
            setProfileField(
              'accepting_new_clients',
              !profileForm?.accepting_new_clients
            )
          }
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          {profileForm?.accepting_new_clients
            ? 'Đang nhận ca mới'
            : 'Tạm ngừng nhận ca'}
        </button>
      </div>
      <button
        onClick={onSaveProfile}
        disabled={savingProfile}
        className="mt-4 w-full rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {savingProfile ? 'Đang lưu...' : 'Lưu hồ sơ công khai'}
      </button>
    </section>
  );
}
