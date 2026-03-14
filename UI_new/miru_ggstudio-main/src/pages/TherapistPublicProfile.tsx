import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { getPublicTherapist, type TherapistPublicProfileDetail } from '../services/profiles';
import { repairMojibake } from '../lib/text';

function buildContactActions(profile: TherapistPublicProfileDetail) {
  return [
    profile.contact_phone
      ? {
        key: 'phone',
        label: 'Goi dien',
        href: `tel:${profile.contact_phone}`,
        icon: Phone,
      }
      : null,
    profile.contact_email
      ? {
        key: 'email',
        label: 'Email',
        href: `mailto:${profile.contact_email}`,
        icon: Mail,
      }
      : null,
    profile.contact_zalo_url
      ? {
        key: 'zalo',
        label: 'Zalo',
        href: profile.contact_zalo_url,
        icon: MessageCircle,
      }
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

export function TherapistPublicProfilePage() {
  const { therapistId } = useParams<{ therapistId: string }>();
  const [profile, setProfile] = useState<TherapistPublicProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!therapistId) {
      setError('Thieu therapist id');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getPublicTherapist(therapistId);
        if (!cancelled) {
          setProfile(response.profile);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được hồ sơ therapist');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [therapistId]);

  const contactActions = useMemo(() => (profile ? buildContactActions(profile) : []), [profile]);

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
        <div className="mx-auto max-w-3xl rounded-[32px] border border-amber-400/30 bg-amber-500/10 px-6 py-8 text-center text-amber-100">
          <p>{repairMojibake(error || 'Không tìm thấy therapist')}</p>
          <Link
            to="/therapists"
            className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Quay lai danh ba
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="glass-panel overflow-hidden rounded-[36px] border border-white/10">
          <div className="bg-gradient-to-br from-miru-primary/25 via-transparent to-cyan-400/10 p-7 md:p-10">
            <Link to="/therapists" className="text-sm text-white/55 transition-colors hover:text-white">
              Quay lai danh ba therapist
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
                  <h1 className="text-4xl font-bold tracking-tight">
                    {repairMojibake(profile.display_name)}
                  </h1>
                  {profile.is_verified && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">
                      <ShieldCheck size={16} />
                      Da xac minh
                    </span>
                  )}
                </div>

                {profile.headline && (
                  <p className="mt-3 max-w-2xl text-lg leading-8 text-white/75">
                    {repairMojibake(profile.headline)}
                  </p>
                )}

                {profile.specializations.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {profile.specializations.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75"
                      >
                        {repairMojibake(item)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-panel rounded-[32px] border border-white/10 p-7">
            <div className="mb-4 text-xs uppercase tracking-[0.35em] text-white/35">
              Gioi thieu
            </div>
            <p className="whitespace-pre-wrap text-sm leading-8 text-white/75 md:text-base">
              {repairMojibake(profile.bio || 'Therapist chưa cập nhật phần giới thiệu công khai.')}
            </p>
          </section>

          <aside className="glass-panel rounded-[32px] border border-white/10 p-7">
            <div className="mb-4 text-xs uppercase tracking-[0.35em] text-white/35">
              Liên hệ
            </div>

            {contactActions.length === 0 ? (
              <p className="text-sm leading-7 text-white/60">
                Therapist chưa công khai kênh liên hệ. Bạn có thể quay lại sau hoặc liên hệ qua kênh mà therapist cung cấp bên ngoài.
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
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-colors hover:bg-white/10"
                    >
                      <span className="inline-flex items-center gap-3">
                        <Icon size={18} className="text-miru-primary" />
                        {action.label}
                      </span>
                      <ExternalLink size={16} className="text-white/35" />
                    </a>
                  );
                })}
              </div>
            )}
          </aside>
        </div>

        <section className="glass-panel rounded-[32px] border border-white/10 p-7">
          <div className="mb-4 text-xs uppercase tracking-[0.35em] text-white/35">
            Chung chi va bang cap
          </div>

          {profile.certificate_images.length === 0 ? (
            <p className="text-sm text-white/60">Therapist chưa thêm ảnh chứng chỉ công khai.</p>
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
                      alt={`Chung chi ${index + 1} cua ${profile.display_name}`}
                      className="h-56 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-sm text-white/40">
                      Không tải được ảnh
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
