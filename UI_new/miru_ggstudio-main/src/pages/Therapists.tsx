import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, ShieldCheck } from 'lucide-react';
import { ContactRequestModal } from '../components/profiles/ContactRequestModal';
import { TherapistOfferingBadges } from '../components/profiles/TherapistOfferingBadges';
import type { TherapistPublicProfileCard } from '../services/profiles';
import { publicTherapistsQueryOptions } from '../queries/appQueries';
import { trackMyTrajectoryEvent } from '../services/trajectory';

function getContactCount(profile: TherapistPublicProfileCard) {
  return [
    profile.contact_phone,
    profile.contact_email,
    profile.contact_zalo_url,
    profile.contact_facebook_url,
    profile.contact_website_url,
  ].filter((value) => typeof value === 'string' && value.trim()).length;
}

export function TherapistsDirectory() {
  const [search, setSearch] = useState('');
  const [selectedTherapist, setSelectedTherapist] =
    useState<TherapistPublicProfileCard | null>(null);
  const trackedDirectoryOpenRef = useRef(false);
  const deferredSearch = useDeferredValue(search);
  const therapistsQuery = useQuery(publicTherapistsQueryOptions());
  const therapists = (therapistsQuery.data?.therapists ?? []) as TherapistPublicProfileCard[];
  const loading = therapistsQuery.isLoading;
  const error =
    therapistsQuery.error instanceof Error ? therapistsQuery.error.message : null;

  useEffect(() => {
    if (trackedDirectoryOpenRef.current) {
      return;
    }
    trackedDirectoryOpenRef.current = true;
    void trackMyTrajectoryEvent({
      event_type: 'therapist_directory_opened',
      metadata: {
        source: 'directory_page',
      },
    }).catch(() => undefined);
  }, []);

  const filteredTherapists = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    if (!keyword) {
      return therapists;
    }
    return therapists.filter((profile) => {
      const haystack = [
        profile.display_name,
        profile.headline ?? '',
        profile.bio ?? '',
        ...(profile.specializations ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [deferredSearch, therapists]);

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="glass-panel rounded-[32px] p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                Danh bạ therapist
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
                Tìm nhà trị liệu phù hợp với bạn
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 dark:text-white/65 md:text-base">
                Xem cách làm việc, hình thức hỗ trợ, mức giá tham khảo và gửi yêu
                cầu liên hệ trực tiếp ngay từ danh bạ.
              </p>
            </div>

            <label className="relative block w-full max-w-md">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40"
                size={18}
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên hoặc chuyên môn..."
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 placeholder:text-slate-400 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
              />
            </label>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="glass-panel h-[320px] animate-pulse rounded-[28px] border border-white/10 bg-white/5"
                />
              ))
            : filteredTherapists.map((profile) => (
                <article
                  key={profile.therapist_id}
                  className="glass-panel rounded-[28px] border border-white/10 p-6 transition-transform duration-200 hover:-translate-y-1"
                >
                  <div className="flex items-start gap-4">
                    {profile.avatar_image?.url ? (
                      <img
                        src={profile.avatar_image.url}
                        alt={profile.display_name}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-miru-primary/20 text-xl font-semibold text-miru-primary">
                        {profile.display_name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-xl font-semibold text-slate-900 dark:text-white">
                          {profile.display_name}
                        </h2>
                        {profile.is_verified && (
                          <ShieldCheck size={16} className="text-emerald-400" />
                        )}
                      </div>
                      {profile.headline && (
                        <p className="mt-1 text-sm text-slate-600 dark:text-white/60">
                          {profile.headline}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-5">
                    <TherapistOfferingBadges profile={profile} />
                  </div>

                  {profile.specializations.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {profile.specializations.slice(0, 4).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-miru-primary/20 bg-miru-primary/10 px-3 py-1 text-xs text-miru-primary"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mt-5 line-clamp-4 min-h-[96px] text-sm leading-7 text-slate-700 dark:text-white/70">
                    {profile.bio ||
                      'Hồ sơ công khai sẽ hiển thị phần giới thiệu của therapist tại đây.'}
                  </p>

                  <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/35">
                    <span>{getContactCount(profile)} kênh liên hệ</span>
                    <span>{profile.certificate_images.length} hình chứng chỉ</span>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      to={`/therapists/${profile.therapist_id}`}
                      className="inline-flex items-center justify-center rounded-2xl bg-miru-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-miru-primary/85"
                    >
                      Xem hồ sơ
                    </Link>
                    {profile.can_receive_contact_requests && (
                      <button
                        onClick={() => setSelectedTherapist(profile)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                      >
                        Liên hệ ngay
                      </button>
                    )}
                  </div>
                </article>
              ))}
        </div>

        {!loading && filteredTherapists.length === 0 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/55">
            Không tìm thấy therapist phù hợp với từ khóa hiện tại.
          </div>
        )}
      </div>

      {selectedTherapist && (
        <ContactRequestModal
          open={Boolean(selectedTherapist)}
          therapist={selectedTherapist}
          source="directory"
          onClose={() => setSelectedTherapist(null)}
        />
      )}
    </div>
  );
}
