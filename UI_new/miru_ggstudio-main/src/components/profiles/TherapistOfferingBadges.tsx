import type { TherapistPublicProfileCard } from '../../services/profiles';

function formatVnd(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function TherapistOfferingBadges({ profile }: { profile: TherapistPublicProfileCard }) {
  const badges: Array<{ label: string; className: string }> = [];

  if (!profile.accepting_new_clients) {
    badges.push({
      label: 'Tạm ngừng nhận thân chủ',
      className: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    });
  } else if (profile.service_mode === 'free') {
    badges.push({
      label: 'Miễn phí',
      className: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
    });
  } else if (profile.service_mode === 'paid' && profile.starting_price_vnd) {
    badges.push({
      label: `Có phí từ ${formatVnd(profile.starting_price_vnd)}đ`,
      className: 'border-sky-400/20 bg-sky-500/10 text-sky-100',
    });
  } else if (profile.service_mode === 'both') {
    badges.push({
      label: profile.starting_price_vnd
        ? `Miễn phí / Có phí từ ${formatVnd(profile.starting_price_vnd)}đ`
        : 'Miễn phí hoặc có phí',
      className: 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100',
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
