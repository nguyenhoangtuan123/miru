import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { ContactRequestModal } from '../components/profiles/ContactRequestModal';
import { TherapistOfferingBadges } from '../components/profiles/TherapistOfferingBadges';
import { publicTherapistDetailQueryOptions } from '../queries/appQueries';
import type { TherapistPublicProfileDetail } from '../services/profiles';

function useTherapistProfile() {
  const { therapistId } = useParams<{ therapistId: string }>();
  const query = useQuery({
    ...publicTherapistDetailQueryOptions(therapistId ?? ''),
    enabled: Boolean(therapistId),
  });

  return {
    therapistId,
    profile: (query.data?.profile ?? null) as TherapistPublicProfileDetail | null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}

function buildContactActions(
  profile: NonNullable<ReturnType<typeof useTherapistProfile>['profile']>
) {
  return [
    profile.contact_phone
      ? { key: 'phone', label: 'Gọi điện', href: `tel:${profile.contact_phone}`, icon: Phone }
      : null,
    profile.contact_email
      ? { key: 'email', label: 'Email', href: `mailto:${profile.contact_email}`, icon: Mail }
      : null,
    profile.contact_zalo_url
      ? { key: 'zalo', label: 'Zalo', href: profile.contact_zalo_url, icon: MessageCircle }
      : null,
    profile.contact_facebook_url
      ? {
          key: 'facebook',
          label: 'Facebook',
          href: profile.contact_facebook_url,
          icon: ExternalLink,
        }
      : null,
    profile.contact_website_url
      ? {
          key: 'website',
          label: 'Website',
          href: profile.contact_website_url,
          icon: ExternalLink,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function formatVnd(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatPricingUnit(value: TherapistPublicProfileDetail['pricing_unit']) {
  switch (value) {
    case 'package':
      return 'gói';
    case 'custom':
      return 'thoả thuận';
    default:
      return 'phiên';
  }
}

export function TherapistPublicProfilePage() {
  const { profile, loading, error } = useTherapistProfile();
  const [contactOpen, setContactOpen] = useState(false);
  const contactActions = useMemo(
    () => (profile ? buildContactActions(profile) : []),
    [profile]
  );

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-5xl animate-pulse space-y-6">
          <div className="glass-panel h-64 rounded-[32px] bg-white/5" />
          <div className="glass-panel h-80 rounded-[32px] bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-amber-200 bg-amber-50 px-6 py-8 text-center text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p>{error || 'Không tìm thấy therapist'}</p>
          <Link
            to="/therapists"
            className="mt-5 inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            Quay lại danh bạ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="glass-panel overflow-hidden rounded-[36px] border border-white/10">
          <div className="bg-gradient-to-br from-miru-primary/25 via-transparent to-cyan-400/10 p-7 md:p-10">
            <Link
              to="/therapists"
              className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-white/55 dark:hover:text-white"
            >
              Quay lại danh bạ therapist
            </Link>

            <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-center">
              {profile.avatar_image?.url ? (
                <img
                  src={profile.avatar_image.url}
                  alt={profile.display_name}
                  className="h-28 w-28 rounded-[28px] object-cover shadow-2xl"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-miru-primary/20 text-4xl font-bold text-miru-primary">
                  {profile.display_name.charAt(0)}
                </div>
              )}

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {profile.display_name}
                  </h1>
                  {profile.is_verified && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                      <ShieldCheck size={16} />
                      Đã xác minh
                    </span>
                  )}
                </div>

                {profile.headline && (
                  <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-700 dark:text-white/75">
                    {profile.headline}
                  </p>
                )}

                <div className="mt-5">
                  <TherapistOfferingBadges profile={profile} />
                </div>

                {profile.specializations.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {profile.specializations.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/75"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {profile.can_receive_contact_requests && (
                  <button
                    onClick={() => setContactOpen(true)}
                    className="mt-6 inline-flex items-center justify-center rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-miru-primary/85"
                  >
                    Liên hệ ngay
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-panel rounded-[32px] border border-white/10 p-7">
            <div className="mb-4 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
              Giới thiệu
            </div>
            <p className="whitespace-pre-wrap text-sm leading-8 text-slate-700 dark:text-white/75 md:text-base">
              {profile.bio || 'Therapist chưa cập nhật phần giới thiệu công khai.'}
            </p>

            {profile.public_workflow_steps.length > 0 && (
              <div className="mt-8">
                <div className="mb-4 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                  Lộ trình làm việc
                </div>
                <ol className="space-y-3">
                  {profile.public_workflow_steps.map((step, index) => (
                    <li
                      key={`${step}-${index}`}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/75"
                    >
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-miru-primary/20 text-xs font-semibold text-miru-primary">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <section className="glass-panel rounded-[32px] border border-white/10 p-7">
              <div className="mb-4 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                Chi phí và thanh toán
              </div>
              <div className="space-y-3 text-sm text-slate-700 dark:text-white/75">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="text-slate-500 dark:text-white/50">
                    Trạng thái nhận thân chủ
                  </div>
                  <div className="mt-1 font-semibold">
                    {profile.accepting_new_clients
                      ? 'Đang nhận thân chủ mới'
                      : 'Tạm ngừng nhận thân chủ'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="text-slate-500 dark:text-white/50">
                    Hình thức hỗ trợ
                  </div>
                  <div className="mt-1 font-semibold">
                    {profile.service_mode === 'free'
                      ? 'Miễn phí'
                      : profile.service_mode === 'paid'
                        ? 'Có phí'
                        : 'Miễn phí hoặc có phí'}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="text-slate-500 dark:text-white/50">
                    Giá khởi điểm
                  </div>
                  <div className="mt-1 font-semibold">
                    {profile.starting_price_vnd
                      ? `${formatVnd(profile.starting_price_vnd)}đ / ${formatPricingUnit(
                          profile.pricing_unit
                        )}`
                      : 'Therapist sẽ trao đổi thêm sau khi tiếp nhận'}
                  </div>
                </div>
                {profile.pricing_note && (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="text-slate-500 dark:text-white/50">
                      Ghi chú giá dịch vụ
                    </div>
                    <div className="mt-1">{profile.pricing_note}</div>
                  </div>
                )}
                {profile.public_payment_note && (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="text-slate-500 dark:text-white/50">
                      Ghi chú thanh toán
                    </div>
                    <div className="mt-1">{profile.public_payment_note}</div>
                  </div>
                )}
              </div>
            </section>

            <section className="glass-panel rounded-[32px] border border-white/10 p-7">
              <div className="mb-4 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
                Liên hệ ngoài app
              </div>
              {contactActions.length === 0 ? (
                <p className="text-sm leading-7 text-slate-600 dark:text-white/60">
                  Therapist chưa công khai kênh liên hệ ngoài app. Bạn vẫn có thể
                  dùng nút Liên hệ ngay để gửi yêu cầu trực tiếp.
                </p>
              ) : (
                <div className="space-y-3">
                  {contactActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <a
                        key={action.key}
                        href={action.href}
                        target={action.href.startsWith('http') ? '_blank' : undefined}
                        rel={action.href.startsWith('http') ? 'noreferrer' : undefined}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <span className="inline-flex items-center gap-3">
                          <Icon size={18} className="text-miru-primary" />
                          {action.label}
                        </span>
                        <ExternalLink
                          size={16}
                          className="text-slate-400 dark:text-white/35"
                        />
                      </a>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>

        <section className="glass-panel rounded-[32px] border border-white/10 p-7">
          <div className="mb-4 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
            Chứng chỉ và bằng cấp
          </div>
          {profile.certificate_images.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-white/60">
              Therapist chưa thêm ảnh chứng chỉ công khai.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.certificate_images.map((asset, index) => (
                <a
                  key={asset.id ?? `${asset.url}-${index}`}
                  href={asset.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-[24px] border border-white/10 bg-white/5"
                >
                  {asset.url ? (
                    <img
                      src={asset.url}
                      alt={`Chứng chỉ ${index + 1} của ${profile.display_name}`}
                      className="h-56 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-sm text-slate-400 dark:text-white/40">
                      Không tải được ảnh
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>
      </div>

      <ContactRequestModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        therapist={profile}
        source="profile_direct_link"
      />
    </div>
  );
}
