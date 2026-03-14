import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Camera, Globe2, ImagePlus, Link as LinkIcon, ShieldCheck, Trash2 } from 'lucide-react';
import {
  deleteMyTherapistMedia,
  getMyTherapistProfile,
  updateMyTherapistProfile,
  uploadMyTherapistAvatar,
  uploadMyTherapistCertificates,
  type TherapistPublicProfileDetail,
  type TherapistPublicProfileForm,
} from '../../services/profiles';
import { repairMojibake } from '../../lib/text';

function toForm(profile: TherapistPublicProfileDetail): TherapistPublicProfileForm {
  return {
    display_name: profile.display_name ?? '',
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    specializations: profile.specializations ?? [],
    contact_phone: profile.contact_phone ?? '',
    contact_email: profile.contact_email ?? '',
    contact_zalo_url: profile.contact_zalo_url ?? '',
    contact_facebook_url: profile.contact_facebook_url ?? '',
    contact_website_url: profile.contact_website_url ?? '',
    is_public: Boolean(profile.is_public),
  };
}

export function TherapistProfilePage() {
  const [profile, setProfile] = useState<TherapistPublicProfileDetail | null>(null);
  const [form, setForm] = useState<TherapistPublicProfileForm>({
    display_name: '',
    headline: '',
    bio: '',
    specializations: [],
    contact_phone: '',
    contact_email: '',
    contact_zalo_url: '',
    contact_facebook_url: '',
    contact_website_url: '',
    is_public: false,
  });
  const [specializationsInput, setSpecializationsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCertificates, setUploadingCertificates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getMyTherapistProfile();
        if (!cancelled) {
          setProfile(response.profile);
          setForm(toForm(response.profile));
          setSpecializationsInput((response.profile.specializations ?? []).join(', '));
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
  }, []);

  const contactLinksCount = useMemo(
    () =>
      [
        form.contact_phone,
        form.contact_email,
        form.contact_zalo_url,
        form.contact_facebook_url,
        form.contact_website_url,
      ].filter((value) => value.trim()).length,
    [form]
  );

  function setField<K extends keyof TherapistPublicProfileForm>(key: K, value: TherapistPublicProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    const nextForm: TherapistPublicProfileForm = {
      ...form,
      specializations: specializationsInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await updateMyTherapistProfile(nextForm);
      setProfile(response.profile);
      setForm(toForm(response.profile));
      setSpecializationsInput((response.profile.specializations ?? []).join(', '));
      setMessage(response.profile.is_public ? 'Hồ sơ công khai đã được cập nhật.' : 'Hồ sơ đã được lưu ở chế độ ẩn.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được hồ sơ therapist');
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
      const response = await uploadMyTherapistAvatar(file);
      setProfile(response.profile);
      setForm(toForm(response.profile));
      setMessage('Đã cập nhật ảnh đại diện công khai.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không tải được ảnh đại diện');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleCertificatesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []) as File[];
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    try {
      setUploadingCertificates(true);
      setError(null);
      setMessage(null);
      const response = await uploadMyTherapistCertificates(files);
      setProfile(response.profile);
      setForm(toForm(response.profile));
      setMessage('Đã thêm ảnh chứng chỉ vào hồ sơ công khai.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không tải được ảnh chứng chỉ');
    } finally {
      setUploadingCertificates(false);
    }
  }

  async function handleDeleteMedia(mediaId: string | null | undefined) {
    if (!mediaId) {
      return;
    }
    try {
      setError(null);
      setMessage(null);
      const response = await deleteMyTherapistMedia(mediaId);
      setProfile(response.profile);
      setForm(toForm(response.profile));
      setMessage('Đã xóa media khỏi hồ sơ công khai.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không xóa được media');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="glass-panel h-52 animate-pulse rounded-[32px] bg-white/5" />
          <div className="glass-panel h-96 animate-pulse rounded-[32px] bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
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
                <div className="flex h-28 w-28 items-center justify-center rounded-[28px] bg-miru-primary/20 text-4xl font-bold text-miru-primary">
                  {(profile?.display_name ?? 'T').charAt(0)}
                </div>
              )}
              <label className="absolute -bottom-2 -right-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-black/70 text-white transition-colors hover:bg-black">
                <Camera size={18} />
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xs uppercase tracking-[0.35em] text-white/35">
                  Public Therapist Profile
                </div>
                {profile?.is_verified && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    <ShieldCheck size={14} />
                    Đã xác minh
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-3xl font-bold">
                {repairMojibake(profile?.display_name ?? 'Hồ sơ công khai')}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                Đây là trang therapist tự quản lý thông tin công khai, kênh liên hệ và ảnh bằng cấp. Chi khi bật chế độ công khai thì therapist mới xuất hiện trong danh bạ trên trang chủ và /therapists.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {repairMojibake(error)}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {repairMojibake(message)}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/35">
              Nội dung công khai
            </div>

            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Tên hiển thị</span>
                <input
                  value={form.display_name}
                  onChange={(event) => setField('display_name', event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Headline ngắn</span>
                <input
                  value={form.headline}
                  onChange={(event) => setField('headline', event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Chuyên môn</span>
                <input
                  value={specializationsInput}
                  onChange={(event) => setSpecializationsInput(event.target.value)}
                  placeholder="Ví dụ: Trị liệu CBT, Lo âu, Sang chấn"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Giới thiệu chi tiết</span>
                <textarea
                  value={form.bio}
                  onChange={(event) => setField('bio', event.target.value)}
                  rows={9}
                  className="rounded-[28px] border border-white/10 bg-white/5 p-4 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>
            </div>
          </section>

          <aside className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/35">
              Liên hệ công khai
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Số điện thoại</span>
                <input
                  value={form.contact_phone}
                  onChange={(event) => setField('contact_phone', event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Email liên hệ</span>
                <input
                  value={form.contact_email}
                  onChange={(event) => setField('contact_email', event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Link Zalo</span>
                <input
                  value={form.contact_zalo_url}
                  onChange={(event) => setField('contact_zalo_url', event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Link Facebook</span>
                <input
                  value={form.contact_facebook_url}
                  onChange={(event) => setField('contact_facebook_url', event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Website</span>
                <input
                  value={form.contact_website_url}
                  onChange={(event) => setField('contact_website_url', event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">Trạng thái xuất hiện trong danh bạ</div>
                  <p className="mt-1 text-sm text-white/55">
                    Hiện có {contactLinksCount} kênh liên hệ công khai và {profile?.certificate_images.length ?? 0} ảnh chứng chỉ.
                  </p>
                </div>
                <button
                  onClick={() => setField('is_public', !form.is_public)}
                  className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${form.is_public
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'bg-white/10 text-white/55'
                    }`}
                >
                  {form.is_public ? 'Đang công khai' : 'Đang ẩn'}
                </button>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-6 w-full rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Đang lưu...' : 'Lưu hồ sơ công khai'}
            </button>
          </aside>
        </div>

        <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/35">
                <Globe2 size={14} />
                Chứng chỉ công khai
              </div>
              <p className="mt-2 text-sm leading-7 text-white/60">
                Tải tối đa 8 ảnh bằng cấp/chứng chỉ. Mỗi ảnh sẽ hiện ở trang công khai của therapist.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/10">
              <ImagePlus size={18} />
              {uploadingCertificates ? 'Đang tải...' : 'Thêm chứng chỉ'}
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleCertificatesChange}
              />
            </label>
          </div>

          {profile?.certificate_images?.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {profile.certificate_images.map((asset, index) => (
                <div
                  key={asset.id ?? `${asset.url}-${index}`}
                  className="overflow-hidden rounded-[24px] border border-white/10 bg-white/5"
                >
                  {asset.url ? (
                    <img
                      src={asset.url}
                      alt={`Certificate ${index + 1}`}
                      className="h-52 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-52 items-center justify-center text-sm text-white/40">
                      Không tải được ảnh
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="truncate text-sm text-white/65">
                      <LinkIcon size={14} className="mr-2 inline-flex" />
                      {asset.name ?? `Chứng chỉ ${index + 1}`}
                    </span>
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
              Chưa có ảnh chứng chỉ công khai nào.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
