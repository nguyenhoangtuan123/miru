import { Eye, EyeOff, UserCheck, UserX } from 'lucide-react';
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
          Những gì bạn chỉnh ở đây sẽ quyết định cách Miru Community hiển thị profile,
          chuyên môn, mức giá và đường dẫn kết nối của bạn.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Hiển thị trên danh bạ therapist
              </div>
              <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-white/55">
                Tắt mục này nếu bạn muốn ẩn hẳn khỏi Miru Community và danh sách therapist.
              </p>
            </div>
            <div
              className={`rounded-2xl p-3 ${
                profileForm?.is_public
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                  : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/55'
              }`}
            >
              {profileForm?.is_public ? <Eye size={18} /> : <EyeOff size={18} />}
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setProfileField('is_public', true)}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                profileForm?.is_public
                  ? 'bg-miru-primary text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10'
              }`}
            >
              Hiển thị
            </button>
            <button
              type="button"
              onClick={() => setProfileField('is_public', false)}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                profileForm?.is_public
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10'
                  : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              }`}
            >
              Ẩn khỏi danh bạ
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Trạng thái nhận thân chủ mới
              </div>
              <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-white/55">
                Giữ profile công khai nhưng chủ động khóa intake khi bạn đang kín lịch.
              </p>
            </div>
            <div
              className={`rounded-2xl p-3 ${
                profileForm?.accepting_new_clients
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200'
                  : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/55'
              }`}
            >
              {profileForm?.accepting_new_clients ? (
                <UserCheck size={18} />
              ) : (
                <UserX size={18} />
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setProfileField('accepting_new_clients', true)}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                profileForm?.accepting_new_clients
                  ? 'bg-miru-primary text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10'
              }`}
            >
              Đang nhận ca
            </button>
            <button
              type="button"
              onClick={() => setProfileField('accepting_new_clients', false)}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                profileForm?.accepting_new_clients
                  ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10'
                  : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              }`}
            >
              Tạm ngừng nhận
            </button>
          </div>
        </div>
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
            <option value="custom">Thỏa thuận</option>
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
          onChange={(event) => setProfileField('public_payment_note', event.target.value)}
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
            onChange={(event) => setProfileField('contact_zalo_url', event.target.value)}
            placeholder="Link Zalo"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <input
            value={profileForm?.contact_facebook_url ?? ''}
            onChange={(event) => setProfileField('contact_facebook_url', event.target.value)}
            placeholder="Link Facebook"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>
        <input
          value={profileForm?.contact_website_url ?? ''}
          onChange={(event) => setProfileField('contact_website_url', event.target.value)}
          placeholder="Website"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      </div>
    </section>
  );
}
