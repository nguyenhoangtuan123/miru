import { ArrowUpRight, BadgeCheck, Mail, Phone, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TherapistPublicProfileCard } from '../../services/profiles';
import { cn } from '../../lib/utils';

type TherapistDirectoryCardProps = {
  therapist: TherapistPublicProfileCard;
  featured?: boolean;
};

function pickContactLabel(therapist: TherapistPublicProfileCard) {
  if (therapist.contact_phone) {
    return { icon: Phone, label: 'Liên hệ nhanh' };
  }
  if (therapist.contact_email) {
    return { icon: Mail, label: 'Gửi email' };
  }
  return { icon: Sparkles, label: 'Xem hồ sơ' };
}

export function TherapistDirectoryCard({
  therapist,
  featured = false,
}: TherapistDirectoryCardProps) {
  const contact = pickContactLabel(therapist);
  const ContactIcon = contact.icon;

  return (
    <Link
      to={`/therapists/${therapist.therapist_id}`}
      className={cn(
        'group glass-panel block overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:bg-white/10',
        featured ? 'border-miru-primary/30 bg-white/7' : ''
      )}
    >
      <div className="relative overflow-hidden p-6">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-miru-primary/20 via-sky-400/8 to-transparent opacity-90" />

        <div className="relative flex items-start gap-4">
          {therapist.avatar_image?.url ? (
            <img
              src={therapist.avatar_image.url}
              alt={therapist.display_name}
              className="h-18 w-18 rounded-3xl border border-white/10 object-cover shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
            />
          ) : (
            <div className="flex h-18 w-18 items-center justify-center rounded-3xl border border-white/10 bg-miru-primary/18 text-2xl font-semibold text-miru-primary shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
              {therapist.display_name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-xl font-semibold text-white">
                    {therapist.display_name}
                  </h3>
                  {therapist.is_verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/12 px-2.5 py-1 text-xs font-medium text-emerald-200">
                      <BadgeCheck size={14} />
                      Đã xác minh
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-sky-100/78">
                  {therapist.headline || 'Hồ sơ trị liệu đã sẵn sàng để bạn tìm hiểu.'}
                </p>
              </div>

              <ArrowUpRight
                size={20}
                className="mt-1 shrink-0 text-white/40 transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-white"
              />
            </div>
          </div>
        </div>

        <p className="relative mt-5 line-clamp-3 text-sm leading-7 text-white/68">
          {therapist.bio ||
            'Therapist chưa viết giới thiệu chi tiết, nhưng bạn vẫn có thể vào hồ sơ để xem cách liên hệ và bằng cấp.'}
        </p>

        <div className="relative mt-5 flex flex-wrap gap-2">
          {therapist.specializations.slice(0, 4).map((item) => (
            <span
              key={item}
              className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-medium text-white/72"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="relative mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <ContactIcon size={16} className="text-miru-primary" />
            <span>{contact.label}</span>
          </div>
          <span className="text-sm font-medium text-miru-primary">Mở chi tiết</span>
        </div>
      </div>
    </Link>
  );
}
