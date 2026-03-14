import { Trash2 } from 'lucide-react';
import type { ProfileImageAsset } from '../../services/profiles';

type ProfileAssetGridProps = {
  assets: ProfileImageAsset[];
  emptyLabel: string;
  onDelete?: (asset: ProfileImageAsset) => void;
};

export function ProfileAssetGrid({ assets, emptyLabel, onDelete }: ProfileAssetGridProps) {
  if (assets.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 bg-white/4 px-4 py-8 text-center text-sm text-white/45">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {assets.map((asset) => (
        <div key={asset.id} className="glass-panel overflow-hidden">
          {asset.url ? (
            <img
              src={asset.url}
              alt={asset.name || 'Profile asset'}
              className="h-48 w-full object-cover"
            />
          ) : (
            <div className="flex h-48 items-center justify-center bg-white/5 text-sm text-white/45">
              Khong co hinh xem truoc
            </div>
          )}

          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{asset.name || 'Tap tin khong ten'}</p>
              <p className="mt-1 text-xs text-white/45">
                {asset.uploaded_at
                  ? new Date(asset.uploaded_at).toLocaleString('vi-VN')
                  : 'Chua ro thoi gian'}
              </p>
            </div>

            {onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(asset)}
                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
