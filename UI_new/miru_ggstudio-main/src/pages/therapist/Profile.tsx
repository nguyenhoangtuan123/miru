import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Globe2, ImagePlus, Link as LinkIcon, ShieldCheck, Trash2 } from 'lucide-react';
import {
  deleteMyTherapistMedia,
  getMyTherapistBillingProfile,
  getMyTherapistProfile,
  updateMyTherapistBillingProfile,
  updateMyTherapistProfile,
  uploadMyTherapistAvatar,
  uploadMyTherapistCertificates,
  type TherapistBillingProfileForm,
  type TherapistPublicProfileDetail,
  type TherapistPublicProfileForm,
} from '../../services/profiles';
import {
  queryKeys,
  therapistBillingProfileQueryOptions,
  therapistProfileQueryOptions,
} from '../../queries/appQueries';

function toProfileForm(profile: TherapistPublicProfileDetail): TherapistPublicProfileForm {
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
    accepting_new_clients: Boolean(profile.accepting_new_clients),
    service_mode: profile.service_mode ?? 'both',
    starting_price_vnd: profile.starting_price_vnd ?? null,
    pricing_unit: profile.pricing_unit ?? 'session',
    pricing_note: profile.pricing_note ?? '',
    public_payment_note: profile.public_payment_note ?? '',
    public_workflow_steps: profile.public_workflow_steps ?? [],
  };
}

function toBillingForm(
  profile:
    | Awaited<ReturnType<typeof getMyTherapistBillingProfile>>['profile']
    | null
    | undefined
): TherapistBillingProfileForm {
  return {
    payment_mode: profile?.payment_mode ?? 'manual',
    bank_account_name: profile?.bank_account_name ?? '',
    bank_name: profile?.bank_name ?? '',
    bank_account_number: profile?.bank_account_number ?? '',
    momo_phone: profile?.momo_phone ?? '',
    transfer_note: profile?.transfer_note ?? '',
  };
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TherapistProfilePage() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery(therapistProfileQueryOptions());
  const billingQuery = useQuery(therapistBillingProfileQueryOptions());
  const profile = (profileQuery.data?.profile ?? null) as TherapistPublicProfileDetail | null;
  const billingProfile = (billingQuery.data?.profile ?? null) as Awaited<
    ReturnType<typeof getMyTherapistBillingProfile>
  >['profile'] | null;
  const [profileForm, setProfileForm] = useState<TherapistPublicProfileForm | null>(null);
  const [billingForm, setBillingForm] = useState<TherapistBillingProfileForm>(toBillingForm(null));
  const [specializationsInput, setSpecializationsInput] = useState('');
  const [workflowInput, setWorkflowInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCertificates, setUploadingCertificates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }
    const next = toProfileForm(profile);
    setProfileForm(next);
    setSpecializationsInput((next.specializations ?? []).join(', '));
    setWorkflowInput((next.public_workflow_steps ?? []).join('\n'));
  }, [profile]);

  useEffect(() => {
    setBillingForm(toBillingForm(billingProfile));
  }, [billingProfile]);

  const loading = profileQuery.isLoading || billingQuery.isLoading || !profileForm;

  const contactLinksCount = useMemo(
    () =>
      [
        profileForm?.contact_phone,
        profileForm?.contact_email,
        profileForm?.contact_zalo_url,
        profileForm?.contact_facebook_url,
        profileForm?.contact_website_url,
      ].filter((value) => typeof value === 'string' && value.trim()).length,
    [profileForm]
  );

  function setProfileField<K extends keyof TherapistPublicProfileForm>(key: K, value: TherapistPublicProfileForm[K]) {
    setProfileForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function refreshProfile() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.profiles.therapistMe() });
    await queryClient.invalidateQueries({ queryKey: ['profiles', 'therapists', 'public'] });
  }

  async function handleSaveProfile() {
    if (!profileForm) {
      return;
    }
    try {
      setSavingProfile(true);
      setError(null);
      setMessage(null);
      const response = await updateMyTherapistProfile({
        ...profileForm,
        specializations: specializationsInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        public_workflow_steps: splitLines(workflowInput),
      });
      const nextProfile = response.profile as TherapistPublicProfileDetail;
      setProfileForm(toProfileForm(nextProfile));
      setSpecializationsInput((nextProfile.specializations ?? []).join(', '));
      setWorkflowInput((nextProfile.public_workflow_steps ?? []).join('\n'));
      await refreshProfile();
      setMessage('Đã lưu hồ sơ công khai, dịch vụ và lộ trình làm việc.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được hồ sơ therapist');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveBilling() {
    try {
      setSavingBilling(true);
      setError(null);
      setMessage(null);
      await updateMyTherapistBillingProfile(billingForm);
      await queryClient.invalidateQueries({ queryKey: queryKeys.profiles.therapistBilling() });
      setMessage('Đã lưu thông tin thanh toán nội bộ.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được hồ sơ thanh toán');
    } finally {
      setSavingBilling(false);
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
      await uploadMyTherapistAvatar(file);
      await refreshProfile();
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
      await uploadMyTherapistCertificates(files);
      await refreshProfile();
      setMessage('Đã thêm chứng chỉ công khai.');
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
      await deleteMyTherapistMedia(mediaId);
      await refreshProfile();
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
      <div className="mx-auto max-w-6xl space-y-6">
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
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <ShieldCheck size={14} />
                    Đã xác minh
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-3xl font-bold text-white">{profile?.display_name ?? 'Hồ sơ công khai'}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                Tại đây bạn có thể quản lý hồ sơ công khai, mức giá hiển thị, lộ trình làm việc và thông tin thanh toán nội bộ dùng sau khi chấp nhận yêu cầu liên hệ.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/35">Nội dung công khai</div>

            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Tên hiển thị</span>
                <input
                  value={profileForm?.display_name ?? ''}
                  onChange={(event) => setProfileField('display_name', event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Headline ngắn</span>
                <input
                  value={profileForm?.headline ?? ''}
                  onChange={(event) => setProfileField('headline', event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Chuyên môn</span>
                <input
                  value={specializationsInput}
                  onChange={(event) => setSpecializationsInput(event.target.value)}
                  placeholder="Ví dụ: CBT, lo âu, trị liệu sang chấn"
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Giới thiệu chi tiết</span>
                <textarea
                  value={profileForm?.bio ?? ''}
                  onChange={(event) => setProfileField('bio', event.target.value)}
                  rows={7}
                  className="rounded-[28px] border border-white/10 bg-white/5 p-4 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
              <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/35">Công khai dịch vụ</div>

              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Trạng thái nhận thân chủ</span>
                  <select
                    value={profileForm?.accepting_new_clients ? 'open' : 'closed'}
                    onChange={(event) => setProfileField('accepting_new_clients', event.target.value === 'open')}
                    className="rounded-2xl border border-white/10 bg-miru-bg px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                  >
                    <option value="open">Đang nhận thân chủ mới</option>
                    <option value="closed">Tạm ngừng nhận</option>
                  </select>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm text-white/70">Hình thức</span>
                    <select
                      value={profileForm?.service_mode ?? 'both'}
                      onChange={(event) => setProfileField('service_mode', event.target.value as TherapistPublicProfileForm['service_mode'])}
                      className="rounded-2xl border border-white/10 bg-miru-bg px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                    >
                      <option value="free">Miễn phí</option>
                      <option value="paid">Có phí</option>
                      <option value="both">Miễn phí hoặc có phí</option>
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-white/70">Đơn vị giá</span>
                    <select
                      value={profileForm?.pricing_unit ?? 'session'}
                      onChange={(event) => setProfileField('pricing_unit', event.target.value as TherapistPublicProfileForm['pricing_unit'])}
                      className="rounded-2xl border border-white/10 bg-miru-bg px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                    >
                      <option value="session">Theo phiên</option>
                      <option value="package">Theo gói</option>
                      <option value="custom">Thoả thuận</option>
                    </select>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Giá khởi điểm (VNĐ)</span>
                  <input
                    value={profileForm?.starting_price_vnd ?? ''}
                    onChange={(event) =>
                      setProfileField(
                        'starting_price_vnd',
                        event.target.value ? Number(event.target.value) : null
                      )
                    }
                    inputMode="numeric"
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Ghi chú giá dịch vụ</span>
                  <textarea
                    value={profileForm?.pricing_note ?? ''}
                    onChange={(event) => setProfileField('pricing_note', event.target.value)}
                    rows={3}
                    className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white focus:border-miru-primary/50 focus:outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Ghi chú thanh toán công khai</span>
                  <textarea
                    value={profileForm?.public_payment_note ?? ''}
                    onChange={(event) => setProfileField('public_payment_note', event.target.value)}
                    rows={3}
                    className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white focus:border-miru-primary/50 focus:outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Lộ trình làm việc công khai (mỗi dòng một bước)</span>
                  <textarea
                    value={workflowInput}
                    onChange={(event) => setWorkflowInput(event.target.value)}
                    rows={5}
                    className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white focus:border-miru-primary/50 focus:outline-none"
                  />
                </label>
              </div>
            </section>

            <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
              <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/35">Liên hệ công khai</div>
              <div className="grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Số điện thoại</span>
                  <input value={profileForm?.contact_phone ?? ''} onChange={(event) => setProfileField('contact_phone', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Email liên hệ</span>
                  <input value={profileForm?.contact_email ?? ''} onChange={(event) => setProfileField('contact_email', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Link Zalo</span>
                  <input value={profileForm?.contact_zalo_url ?? ''} onChange={(event) => setProfileField('contact_zalo_url', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Link Facebook</span>
                  <input value={profileForm?.contact_facebook_url ?? ''} onChange={(event) => setProfileField('contact_facebook_url', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-white/70">Website</span>
                  <input value={profileForm?.contact_website_url ?? ''} onChange={(event) => setProfileField('contact_website_url', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
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
                    onClick={() => setProfileField('is_public', !profileForm?.is_public)}
                    className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                      profileForm?.is_public ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/55'
                    }`}
                  >
                    {profileForm?.is_public ? 'Đang công khai' : 'Đang ẩn'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => void handleSaveProfile()}
                disabled={savingProfile}
                className="mt-6 w-full rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingProfile ? 'Đang lưu...' : 'Lưu hồ sơ công khai'}
              </button>
            </section>
          </aside>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/35">
                  <Globe2 size={14} />
                  Chứng chỉ công khai
                </div>
                <p className="mt-2 text-sm leading-7 text-white/60">
                  Tải tối đa 8 ảnh bằng cấp/chứng chỉ. Mỗi ảnh sẽ hiển thị trên trang công khai của therapist.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/10">
                <ImagePlus size={18} />
                {uploadingCertificates ? 'Đang tải...' : 'Thêm chứng chỉ'}
                <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleCertificatesChange} />
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
                      <img src={asset.url} alt={`Certificate ${index + 1}`} className="h-52 w-full object-cover" />
                    ) : (
                      <div className="flex h-52 items-center justify-center text-sm text-white/40">Không tải được ảnh</div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="truncate text-sm text-white/65">
                        <LinkIcon size={14} className="mr-2 inline-flex" />
                        {asset.name ?? `Chứng chỉ ${index + 1}`}
                      </span>
                      {asset.id && (
                        <button
                          onClick={() => void handleDeleteMedia(asset.id)}
                          className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-700 transition-colors hover:bg-red-100 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
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
          </section>

          <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/35">Thanh toán nội bộ</div>
            <p className="mb-5 text-sm leading-7 text-white/60">
              Các thông tin này không hiển thị trên danh bạ công khai. Chúng chỉ dùng để bạn hướng dẫn thanh toán thủ công sau khi chấp nhận yêu cầu liên hệ.
            </p>
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Hình thức thanh toán</span>
                <input value={billingForm.payment_mode ?? ''} onChange={(event) => setBillingForm((current) => ({ ...current, payment_mode: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Tên chủ tài khoản</span>
                <input value={billingForm.bank_account_name ?? ''} onChange={(event) => setBillingForm((current) => ({ ...current, bank_account_name: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Ngân hàng</span>
                <input value={billingForm.bank_name ?? ''} onChange={(event) => setBillingForm((current) => ({ ...current, bank_name: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Số tài khoản</span>
                <input value={billingForm.bank_account_number ?? ''} onChange={(event) => setBillingForm((current) => ({ ...current, bank_account_number: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Số MoMo / ZaloPay</span>
                <input value={billingForm.momo_phone ?? ''} onChange={(event) => setBillingForm((current) => ({ ...current, momo_phone: event.target.value }))} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Cú pháp chuyển khoản</span>
                <textarea value={billingForm.transfer_note ?? ''} onChange={(event) => setBillingForm((current) => ({ ...current, transfer_note: event.target.value }))} rows={3} className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
            </div>

            <button
              onClick={() => void handleSaveBilling()}
              disabled={savingBilling}
              className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-60"
            >
              {savingBilling ? 'Đang lưu...' : 'Lưu thông tin thanh toán'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
