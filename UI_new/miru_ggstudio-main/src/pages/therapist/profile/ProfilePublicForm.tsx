import type { TherapistPublicProfileForm } from '../../../services/profiles';

type Props = {
  profileForm: TherapistPublicProfileForm | null;
  specializationsInput: string;
  workflowInput: string;
  setSpecializationsInput: (value: string) => void;
  setWorkflowInput: (value: string) => void;
  setProfileField: <K extends keyof TherapistPublicProfileForm>(
    key: K,
    value: TherapistPublicProfileForm[K]
  ) => void;
};

export function ProfilePublicForm({
  profileForm,
  specializationsInput,
  workflowInput,
  setSpecializationsInput,
  setWorkflowInput,
  setProfileField,
}: Props) {
  return (
    <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-white/35">
          Community profile studio
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
          Nội dung hồ sơ công khai
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-white/60">
          Những gì bạn chỉnh ở đây sẽ quyết định cách Miru Community hiển thị profile, chuyên môn, mức giá và đường dẫn kết nối của bạn.
        </p>
      </div>
      <div className="grid gap-4">
        <input
          value={profileForm?.display_name ?? ''}
          onChange={(event) => setProfileField('display_name', event.target.value)}
          placeholder="Tên hiển thị"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <input
          value={profileForm?.headline ?? ''}
          onChange={(event) => setProfileField('headline', event.target.value)}
          placeholder="Headline"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <input
          value={specializationsInput}
          onChange={(event) => setSpecializationsInput(event.target.value)}
          placeholder="Chuyên môn nổi bật, cách nhau bằng dấu phẩy"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <textarea
          value={profileForm?.bio ?? ''}
          onChange={(event) => setProfileField('bio', event.target.value)}
          rows={6}
          placeholder="Giới thiệu chi tiết"
          className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <select
            value={profileForm?.service_mode ?? 'both'}
            onChange={(event) =>
              setProfileField(
                'service_mode',
                event.target.value as TherapistPublicProfileForm['service_mode']
              )
            }
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-miru-bg dark:text-white"
          >
            <option value="free">Miễn phí</option>
            <option value="paid">Có phí</option>
            <option value="both">Miễn phí hoặc có phí</option>
          </select>
          <select
            value={profileForm?.pricing_unit ?? 'session'}
            onChange={(event) =>
              setProfileField(
                'pricing_unit',
                event.target.value as TherapistPublicProfileForm['pricing_unit']
              )
            }
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-miru-bg dark:text-white"
          >
            <option value="session">Theo phiên</option>
            <option value="package">Theo gói</option>
            <option value="custom">Thoả thuận</option>
          </select>
        </div>
        <input
          value={profileForm?.starting_price_vnd ?? ''}
          onChange={(event) =>
            setProfileField(
              'starting_price_vnd',
              event.target.value ? Number(event.target.value) : null
            )
          }
          placeholder="Giá khởi điểm (VNĐ)"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <textarea
          value={profileForm?.pricing_note ?? ''}
          onChange={(event) => setProfileField('pricing_note', event.target.value)}
          rows={3}
          placeholder="Ghi chú giá dịch vụ"
          className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <textarea
          value={profileForm?.public_payment_note ?? ''}
          onChange={(event) =>
            setProfileField('public_payment_note', event.target.value)
          }
          rows={3}
          placeholder="Ghi chú thanh toán công khai"
          className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <textarea
          value={workflowInput}
          onChange={(event) => setWorkflowInput(event.target.value)}
          rows={4}
          placeholder="Lộ trình làm việc công khai, mỗi dòng một bước"
          className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={profileForm?.contact_phone ?? ''}
            onChange={(event) => setProfileField('contact_phone', event.target.value)}
            placeholder="Số điện thoại"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <input
            value={profileForm?.contact_email ?? ''}
            onChange={(event) => setProfileField('contact_email', event.target.value)}
            placeholder="Email liên hệ"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <input
            value={profileForm?.contact_zalo_url ?? ''}
            onChange={(event) =>
              setProfileField('contact_zalo_url', event.target.value)
            }
            placeholder="Link Zalo"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <input
            value={profileForm?.contact_facebook_url ?? ''}
            onChange={(event) =>
              setProfileField('contact_facebook_url', event.target.value)
            }
            placeholder="Link Facebook"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>
        <input
          value={profileForm?.contact_website_url ?? ''}
          onChange={(event) =>
            setProfileField('contact_website_url', event.target.value)
          }
          placeholder="Website"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>
    </section>
  );
}
