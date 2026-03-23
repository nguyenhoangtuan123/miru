import { useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { buildPublicTherapistUrl } from '../services/api';

export function TherapistPublicProfilePage() {
  const { therapistId } = useParams<{ therapistId: string }>();
  const location = useLocation();
  const canonicalUrl = useMemo(() => {
    if (!therapistId) {
      return buildPublicTherapistUrl('unknown');
    }
    return `${buildPublicTherapistUrl(therapistId)}${location.search || ''}`;
  }, [location.search, therapistId]);

  useEffect(() => {
    if (!therapistId) {
      return;
    }
    window.location.replace(canonicalUrl);
  }, [canonicalUrl, therapistId]);

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-8 text-center text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
        <div className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/35">
          Miru Community
        </div>
        <h1 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
          Chuyển sang hồ sơ therapist công khai
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-white/60">
          Hồ sơ therapist công khai đã được chuyển sang Community để luồng đọc bài, xem profile và kết nối riêng tư luôn nằm trong cùng một hệ trải nghiệm.
        </p>
        <a
          href={canonicalUrl}
          className="mt-6 inline-flex rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white"
        >
          Mở hồ sơ trên Community
        </a>
      </div>
    </div>
  );
}
