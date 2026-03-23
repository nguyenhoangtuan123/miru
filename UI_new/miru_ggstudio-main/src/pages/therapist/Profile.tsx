import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Eye, UserRoundPlus, Users } from 'lucide-react';
import { buildPublicSiteUrl, buildPublicTherapistUrl } from '../../services/api';
import {
  deleteMyTherapistMedia,
  getMyTherapistBillingProfile,
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
import { ProfileBillingCard } from './profile/ProfileBillingCard';
import { ProfileCertificatesCard } from './profile/ProfileCertificatesCard';
import { ProfileChecklistCard } from './profile/ProfileChecklistCard';
import { ProfileHero } from './profile/ProfileHero';
import { ProfilePublicForm } from './profile/ProfilePublicForm';
import { splitLines, toBillingForm, toProfileForm } from './profile/helpers';

export function TherapistProfilePage() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery(therapistProfileQueryOptions());
  const billingQuery = useQuery(therapistBillingProfileQueryOptions());
  const profile = (profileQuery.data?.profile ?? null) as TherapistPublicProfileDetail | null;
  const [profileForm, setProfileForm] = useState<TherapistPublicProfileForm | null>(null);
  const [billingForm, setBillingForm] = useState<TherapistBillingProfileForm>(
    toBillingForm(null)
  );
  const [specializationsInput, setSpecializationsInput] = useState('');
  const [workflowInput, setWorkflowInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }
    const next = toProfileForm(profile);
    setProfileForm(next);
    setSpecializationsInput(next.specializations.join(', '));
    setWorkflowInput(next.public_workflow_steps.join('\n'));
  }, [profile]);

  useEffect(() => {
    setBillingForm(
      toBillingForm(
        (billingQuery.data?.profile ?? null) as Awaited<
          ReturnType<typeof getMyTherapistBillingProfile>
        >['profile'] | null
      )
    );
  }, [billingQuery.data]);

  const loading = profileQuery.isLoading || billingQuery.isLoading || !profileForm;

  const contactCount = useMemo(
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

  const checklist = useMemo(
    () => [
      { label: 'Có ảnh đại diện công khai', done: Boolean(profile?.avatar_image?.url) },
      { label: 'Có headline rõ ràng', done: Boolean(profileForm?.headline.trim()) },
      { label: 'Có phần giới thiệu chi tiết', done: Boolean(profileForm?.bio.trim()) },
      {
        label: 'Có ít nhất 3 chuyên môn',
        done:
          specializationsInput
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean).length >= 3,
      },
      {
        label: 'Có lộ trình làm việc công khai',
        done: splitLines(workflowInput).length >= 3,
      },
      { label: 'Có ít nhất 1 kênh liên hệ', done: contactCount > 0 },
      { label: 'Đang hiển thị trên danh bạ', done: Boolean(profileForm?.is_public) },
      {
        label: 'Đang nhận thân chủ mới',
        done: Boolean(profileForm?.accepting_new_clients),
      },
    ],
    [contactCount, profile?.avatar_image?.url, profileForm, specializationsInput, workflowInput]
  );

  const checklistDone = checklist.filter((item) => item.done).length;
  const checklistPercent = checklist.length
    ? Math.round((checklistDone / checklist.length) * 100)
    : 0;

  const analyticsCards = [
    { label: 'Lượt xem hồ sơ', value: profile?.profile_view_count ?? 0, icon: Eye },
    {
      label: 'Yêu cầu liên hệ',
      value: profile?.contact_request_count ?? 0,
      icon: UserRoundPlus,
    },
    { label: 'Đã pair', value: profile?.pair_conversion_count ?? 0, icon: Users },
    { label: 'Độ hoàn thiện', value: `${checklistPercent}%`, icon: BarChart3 },
  ];
  const publicProfileUrl = profile?.therapist_id
    ? buildPublicTherapistUrl(profile.therapist_id)
    : null;
  const communityRootUrl = buildPublicSiteUrl('/');

  function setProfileField<K extends keyof TherapistPublicProfileForm>(
    key: K,
    value: TherapistPublicProfileForm[K]
  ) {
    setProfileForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function refreshAll() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.profiles.therapistMe() });
    await queryClient.invalidateQueries({ queryKey: ['profiles', 'therapists', 'public'] });
  }

  async function saveProfile() {
    if (!profileForm) {
      return;
    }
    try {
      setSavingProfile(true);
      setError(null);
      setMessage(null);
      await updateMyTherapistProfile({
        ...profileForm,
        specializations: specializationsInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        public_workflow_steps: splitLines(workflowInput),
      });
      await refreshAll();
      setMessage('Đã lưu hồ sơ công khai và tín hiệu tăng chuyển đổi.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Không lưu được hồ sơ therapist'
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveBilling() {
    try {
      setSavingBilling(true);
      setError(null);
      setMessage(null);
      await updateMyTherapistBillingProfile(billingForm);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.therapistBilling(),
      });
      setMessage('Đã lưu thông tin thanh toán nội bộ.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Không lưu được hồ sơ thanh toán'
      );
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
      setError(null);
      setMessage(null);
      await uploadMyTherapistAvatar(file);
      await refreshAll();
      setMessage('Đã cập nhật ảnh đại diện công khai.');
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Không tải được ảnh đại diện'
      );
    }
  }

  async function handleCertificatesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []) as File[];
    event.target.value = '';
    if (files.length === 0) {
      return;
    }
    try {
      setError(null);
      setMessage(null);
      await uploadMyTherapistCertificates(files);
      await refreshAll();
      setMessage('Đã thêm chứng chỉ công khai.');
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Không tải được ảnh chứng chỉ'
      );
    }
  }

  async function handleDeleteMedia(mediaId?: string | null) {
    if (!mediaId) {
      return;
    }
    try {
      setError(null);
      setMessage(null);
      await deleteMyTherapistMedia(mediaId);
      await refreshAll();
      setMessage('Đã xoá media khỏi hồ sơ công khai.');
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : 'Không xoá được media'
      );
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-sm text-slate-500 dark:text-white/60">
        Đang tải hồ sơ therapist...
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <ProfileHero
          profile={profile}
          profileForm={profileForm}
          analyticsCards={analyticsCards}
          publicProfileUrl={publicProfileUrl}
          communityRootUrl={communityRootUrl}
          onAvatarChange={(event) => void handleAvatarChange(event)}
        />

        {(error || message) && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              error
                ? 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100'
            }`}
          >
            {error ?? message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <ProfilePublicForm
            profileForm={profileForm}
            specializationsInput={specializationsInput}
            workflowInput={workflowInput}
            setSpecializationsInput={setSpecializationsInput}
            setWorkflowInput={setWorkflowInput}
            setProfileField={setProfileField}
          />

          <div className="space-y-6">
            <ProfileChecklistCard
              checklist={checklist}
              checklistPercent={checklistPercent}
              profileForm={profileForm}
              savingProfile={savingProfile}
              setProfileField={setProfileField}
              onSaveProfile={() => void saveProfile()}
            />

            <ProfileCertificatesCard
              certificates={profile?.certificate_images ?? []}
              onCertificatesChange={(event) => void handleCertificatesChange(event)}
              onDeleteMedia={(mediaId) => void handleDeleteMedia(mediaId)}
            />

            <ProfileBillingCard
              billingForm={billingForm}
              savingBilling={savingBilling}
              setBillingForm={setBillingForm}
              onSaveBilling={() => void saveBilling()}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
