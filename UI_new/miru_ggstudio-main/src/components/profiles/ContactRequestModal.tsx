import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  createTherapistContactRequest,
  type TherapistContactRequestCreate,
  type TherapistPublicProfileDetail,
} from '../../services/profiles';
import { queryKeys } from '../../queries/appQueries';

type Props = {
  open: boolean;
  onClose: () => void;
  therapist: TherapistPublicProfileDetail;
};

export function ContactRequestModal({ open, onClose, therapist }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<TherapistContactRequestCreate>({
    therapist_id: therapist.therapist_id,
    message: '',
    preferred_contact_method: 'zalo',
    client_contact_phone: '',
    client_contact_zalo: '',
    service_interest: therapist.service_mode === 'free' ? 'free' : therapist.service_mode === 'paid' ? 'paid' : 'unsure',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const contactHelp = useMemo(() => {
    if (therapist.service_mode === 'free') {
      return 'Therapist này đang hiển thị chế độ miễn phí. Bạn vẫn có thể nói rõ nhu cầu trong lời nhắn.';
    }
    if (therapist.service_mode === 'paid') {
      return 'Therapist này đang làm việc theo hình thức có phí. Hướng dẫn thanh toán thủ công chỉ hiện sau khi yêu cầu được chấp nhận.';
    }
    return 'Bạn có thể nói rõ mình mong muốn buổi miễn phí, có phí, hoặc cần therapist tư vấn thêm.';
  }, [therapist.service_mode]);

  if (!open) {
    return null;
  }

  const handleRequireLogin = () => {
    navigate('/auth/login', {
      state: { from: { pathname: `/therapists/${therapist.therapist_id}` } },
    });
  };

  const handleSubmit = async () => {
    if (!user) {
      handleRequireLogin();
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await createTherapistContactRequest({
        ...form,
        therapist_id: therapist.therapist_id,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.contactRequests.clientMe() });
      setSuccess('Đã gửi yêu cầu liên hệ. Therapist sẽ thấy yêu cầu này trong hộp thư liên hệ.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không gửi được yêu cầu liên hệ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl rounded-[32px] border border-white/10 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-white/35">Liên hệ ngay</div>
            <h2 className="mt-3 text-2xl font-bold text-white">
              Gửi yêu cầu tới {therapist.display_name}
            </h2>
            <p className="mt-2 text-sm leading-7 text-white/60">{contactHelp}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {!user && (
          <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
            Bạn cần đăng nhập trước khi gửi yêu cầu. Sau khi đăng nhập, hệ thống sẽ quay lại đúng hồ sơ này.
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        )}

        <div className="mt-6 grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm text-white/70">Lời nhắn ngắn</span>
            <textarea
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              rows={5}
              placeholder="Hãy mô tả ngắn gọn điều bạn đang cần hỗ trợ hoặc kỳ vọng ở buổi đầu."
              className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-white focus:border-miru-primary/50 focus:outline-none"
            />
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-white/70">Kênh liên hệ mong muốn</span>
              <select
                value={form.preferred_contact_method}
                onChange={(event) =>
                  setForm((current) => ({ ...current, preferred_contact_method: event.target.value }))
                }
                className="rounded-2xl border border-white/10 bg-miru-bg px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
              >
                <option value="zalo">Zalo</option>
                <option value="phone">Điện thoại</option>
                <option value="email">Email</option>
                <option value="facebook">Facebook</option>
                <option value="other">Khác</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-white/70">Nhu cầu dịch vụ</span>
              <select
                value={form.service_interest}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    service_interest: event.target.value as TherapistContactRequestCreate['service_interest'],
                  }))
                }
                className="rounded-2xl border border-white/10 bg-miru-bg px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
              >
                <option value="free">Ưu tiên miễn phí</option>
                <option value="paid">Có thể làm việc có phí</option>
                <option value="unsure">Chưa rõ, muốn được tư vấn thêm</option>
              </select>
            </label>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-white/70">Số điện thoại (tùy chọn)</span>
              <input
                value={form.client_contact_phone}
                onChange={(event) => setForm((current) => ({ ...current, client_contact_phone: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-white/70">Zalo (tùy chọn)</span>
              <input
                value={form.client_contact_zalo}
                onChange={(event) => setForm((current) => ({ ...current, client_contact_zalo: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
              />
            </label>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10"
          >
            Để sau
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Send size={16} />
            {user ? (saving ? 'Đang gửi...' : 'Gửi yêu cầu liên hệ') : 'Đăng nhập để gửi yêu cầu'}
          </button>
        </div>
      </div>
    </div>
  );
}
