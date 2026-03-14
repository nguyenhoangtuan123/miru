import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Mail, UserRound } from 'lucide-react';
import { repairMojibake } from '../../lib/text';
import { therapistClientProfileQueryOptions } from '../../queries/appQueries';

export function TherapistClientProfileDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const profileQuery = useQuery({
    ...therapistClientProfileQueryOptions(clientId ?? ''),
    enabled: Boolean(clientId),
  });
  const profile = profileQuery.data?.profile ?? null;
  const loading = profileQuery.isLoading;
  const error = clientId
    ? profileQuery.error instanceof Error
      ? profileQuery.error.message
      : null
    : 'Thiếu client id';

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="glass-panel h-56 animate-pulse rounded-[32px] bg-white/5" />
          <div className="glass-panel h-72 animate-pulse rounded-[32px] bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-amber-400/30 bg-amber-500/10 px-6 py-8 text-center text-amber-100">
          <p>{repairMojibake(error || 'Không tìm thấy hồ sơ thân chủ')}</p>
          <Link
            to="/therapist/client-profiles"
            className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Quay lai danh sach
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <Link to="/therapist/client-profiles" className="text-sm text-white/55 transition-colors hover:text-white">
            Quay lại hồ sơ thân chủ
          </Link>

          <div className="mt-7 flex flex-col gap-6 md:flex-row md:items-center">
            {profile.avatar_image?.url ? (
              <img
                src={profile.avatar_image.url}
                alt={profile.display_name}
                className="h-28 w-28 rounded-[28px] object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-miru-primary/20 text-miru-primary">
                <UserRound size={34} />
              </div>
            )}

            <div className="flex-1">
              <div className="text-xs uppercase tracking-[0.35em] text-white/35">Client Private Profile</div>
              <h1 className="mt-3 text-3xl font-bold">{repairMojibake(profile.display_name)}</h1>
              {profile.email && (
                <div className="mt-3 inline-flex items-center gap-2 text-sm text-white/55">
                  <Mail size={16} />
                  {repairMojibake(profile.email)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="mb-4 text-xs uppercase tracking-[0.35em] text-white/35">
            Gioi thieu rieng tu
          </div>
          <p className="whitespace-pre-wrap text-sm leading-8 text-white/75 md:text-base">
            {repairMojibake(profile.intro || 'Than chu chua cap nhat phan gioi thieu rieng tu.')}
          </p>
        </div>

        <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="mb-4 text-xs uppercase tracking-[0.35em] text-white/35">
            Gallery rieng tu
          </div>

          {profile.gallery_images.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/10 px-6 py-10 text-center text-sm text-white/45">
              Thân chủ chưa thêm ảnh bổ sung trong hồ sơ riêng tư.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {profile.gallery_images.map((asset, index) => (
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
                      alt={`Client gallery ${index + 1}`}
                      className="h-52 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-52 items-center justify-center text-sm text-white/40">
                      Không tải được ảnh
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
