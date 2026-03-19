import { ChangeEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import type { ProfileImageAsset } from '../../../services/profiles';

type Props = {
  certificates: ProfileImageAsset[];
  onCertificatesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeleteMedia: (mediaId?: string | null) => void;
};

export function ProfileCertificatesCard({
  certificates,
  onCertificatesChange,
  onDeleteMedia,
}: Props) {
  return (
    <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Chứng chỉ công khai
        </h2>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-white">
          <ImagePlus size={16} />
          Thêm
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onCertificatesChange}
          />
        </label>
      </div>
      <div className="space-y-3">
        {certificates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-white/45">
            Chưa có ảnh chứng chỉ công khai.
          </div>
        )}
        {certificates.map((asset, index) => (
          <div
            key={asset.id ?? `${asset.url}-${index}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5"
          >
            <span className="truncate text-slate-700 dark:text-white/75">
              {asset.name ?? `Chứng chỉ ${index + 1}`}
            </span>
            {asset.id && (
              <button
                onClick={() => onDeleteMedia(asset.id)}
                className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
