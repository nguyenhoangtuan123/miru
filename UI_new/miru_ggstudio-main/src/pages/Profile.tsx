import { ChangeEvent, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ImagePlus, Trash2, UserRound } from 'lucide-react';
import {
  deleteMyClientMedia,
  updateMyClientProfile,
  uploadMyClientAvatar,
  uploadMyClientGallery,
} from '../services/profiles';
import { repairMojibake } from '../lib/text';
import { clientProfileQueryOptions, queryKeys } from '../queries/appQueries';

export function ProfilePage() {
  const queryClient = useQueryClient();
  const [intro, setIntro] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const profileQuery = useQuery(clientProfileQueryOptions());
  const profile = profileQuery.data?.profile ?? null;
  const loading = profileQuery.isLoading;

  useEffect(() => {
    if (profile) {
      setIntro(profile.intro ?? '');
    }
  }, [profile]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await updateMyClientProfile({ intro });
      queryClient.setQueryData(clientProfileQueryOptions().queryKey, response);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.clientMe() });
      setMessage('Đã lưu hồ sơ riêng tư của bạn.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được hồ sơ');
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      setUploadingAvatar(true);
      setError(null);
      setMessage(null);
      const response = await uploadMyClientAvatar(file);
      queryClient.setQueryData(clientProfileQueryOptions().queryKey, response);
      setMessage('Đã cập nhật ảnh đại diện.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không tải được ảnh đại diện');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleGalleryChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []) as File[];
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    try {
      setUploadingGallery(true);
      setError(null);
      setMessage(null);
      const response = await uploadMyClientGallery(files);
      queryClient.setQueryData(clientProfileQueryOptions().queryKey, response);
      setMessage('Đã thêm ảnh vào gallery riêng tư.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không tải được ảnh');
    } finally {
      setUploadingGallery(false);
    }
  }

  async function handleDeleteMedia(mediaId: string | null | undefined) {
    if (!mediaId) {
      return;
    }
    try {
      setError(null);
      setMessage(null);
      const response = await deleteMyClientMedia(mediaId);
      queryClient.setQueryData(clientProfileQueryOptions().queryKey, response);
      setMessage('Đã xóa ảnh khỏi hồ sơ.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không xóa được ảnh');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="glass-panel h-48 animate-pulse rounded-[32px] bg-white/5" />
          <div className="glass-panel h-80 animate-pulse rounded-[32px] bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="relative">
              {profile?.avatar_image?.url ? (
                <img
                  src={profile.avatar_image.url}
                  alt={profile.display_name}
                  className="h-28 w-28 rounded-[28px] object-cover"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-miru-primary/20 text-3xl font-semibold text-miru-primary">
                  <UserRound size={34} />
                </div>
              )}
              <label className="absolute -bottom-2 -right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-black/70 text-white transition-colors hover:bg-black">
                <Camera size={18} />
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>

            <div className="flex-1">
              <div className="text-xs uppercase tracking-[0.35em] text-white/35">Hồ sơ riêng tư</div>
              <h1 className="mt-3 text-3xl font-bold">
                {repairMojibake(profile?.display_name ?? 'Hồ sơ của tôi')}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">
                Đây là hồ sơ riêng tư. Chỉ therapist đã kết nối active với bạn mới xem được thông tin và hình ảnh tại đây.
              </p>
            </div>
          </div>
        </div>

        {(error || profileQuery.error) && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {repairMojibake(
              error ??
                (profileQuery.error instanceof Error
                  ? profileQuery.error.message
                  : 'Không tải được hồ sơ')
            )}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {repairMojibake(message)}
          </div>
        )}

        <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="mb-4 text-xs uppercase tracking-[0.35em] text-white/35">Giới thiệu ngắn</div>
          <textarea
            value={intro}
            onChange={(event) => setIntro(event.target.value)}
            rows={8}
            placeholder="Bạn có thể giới thiệu ngắn về mình, mục tiêu trị liệu, cách therapist nên tiếp cận..."
            className="w-full rounded-[28px] border border-white/10 bg-white/5 p-4 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
          />
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-white/45">Tối đa 2000 ký tự.</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : 'Lưu hồ sơ'}
            </button>
          </div>
        </div>

        <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-white/35">Gallery riêng tư</div>
              <p className="mt-2 text-sm leading-7 text-white/60">
                Bạn có thể thêm tối đa 4 ảnh bổ sung. Therapist đã kết nối sẽ xem được tại trang hồ sơ riêng tư của bạn.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/10">
              <ImagePlus size={18} />
              {uploadingGallery ? 'Đang tải...' : 'Thêm ảnh'}
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleGalleryChange}
              />
            </label>
          </div>

          {profile?.gallery_images?.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.gallery_images.map((asset, index) => (
                <div
                  key={asset.id ?? `${asset.url}-${index}`}
                  className="overflow-hidden rounded-[24px] border border-white/10 bg-white/5"
                >
                  {asset.url ? (
                    <img
                      src={asset.url}
                      alt={`Gallery ${index + 1}`}
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-sm text-white/40">
                      Không tải được ảnh
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="truncate text-sm text-white/65">{asset.name ?? `Anh ${index + 1}`}</span>
                    {asset.id && (
                      <button
                        onClick={() => void handleDeleteMedia(asset.id)}
                        className="rounded-xl border border-red-400/20 bg-red-500/10 p-2 text-red-200 transition-colors hover:bg-red-500/20"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-dashed border-white/10 px-6 py-10 text-center text-sm text-white/45">
              Chưa có ảnh bổ sung nào trong hồ sơ riêng tư.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
