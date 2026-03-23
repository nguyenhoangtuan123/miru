import { ChangeEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, Camera, ShieldCheck } from 'lucide-react';
import type {
  TherapistPublicProfileDetail,
  TherapistPublicProfileForm,
} from '../../../services/profiles';

type AnalyticsCard = {
  label: string;
  value: string | number;
  icon: LucideIcon;
};

type Props = {
  profile: TherapistPublicProfileDetail | null;
  profileForm: TherapistPublicProfileForm | null;
  analyticsCards: AnalyticsCard[];
  publicProfileUrl: string | null;
  communityRootUrl: string;
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function ProfileHero({
  profile,
  profileForm,
  analyticsCards,
  publicProfileUrl,
  communityRootUrl,
  onAvatarChange,
}: Props) {
  return (
    <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative">
            {profile?.avatar_image?.url ? (
              <img
                src={profile.avatar_image.url}
                alt={profile.display_name}
                className="h-24 w-24 rounded-[28px] object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-miru-primary/20 text-4xl font-bold text-miru-primary">
                {(profile?.display_name ?? 'T').charAt(0)}
              </div>
            )}
            <label className="absolute -bottom-2 -right-2 flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-black/70 dark:text-white">
              <Camera size={16} />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={onAvatarChange}
              />
            </label>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                {profile?.display_name}
              </h1>
              {profile?.is_verified && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <ShieldCheck size={16} />
                  Đã xác minh
                </span>
              )}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-white/60">
              Đây là studio để therapist tối ưu mặt tiền công khai trên Miru Community, giữ hồ sơ nhất quán với bài viết, lead và trải nghiệm kết nối riêng tư trong app.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={communityRootUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10"
              >
                <span>Mở Miru Community</span>
                <ArrowUpRight size={16} />
              </a>

              {publicProfileUrl ? (
                <a
                  href={publicProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-miru-primary/30 bg-miru-primary/10 px-4 py-2 text-sm font-semibold text-miru-primary transition hover:border-miru-primary/45 hover:bg-miru-primary/15"
                >
                  <span>Xem profile công khai</span>
                  <ArrowUpRight size={16} />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          <div className="font-semibold">
            {profileForm?.is_public ? 'Đang hiển thị trên danh bạ' : 'Đang ẩn khỏi danh bạ'}
          </div>
          <div className="mt-1">
            {profileForm?.accepting_new_clients
              ? 'Đang nhận thân chủ mới'
              : 'Tạm ngừng nhận thân chủ'}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analyticsCards.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-[28px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500 dark:text-white/45">
                  {item.label}
                </div>
                <div className="rounded-2xl bg-miru-primary/10 p-3 text-miru-primary">
                  <Icon size={18} />
                </div>
              </div>
              <div className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
                {item.value}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
