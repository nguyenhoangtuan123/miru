import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useConsent } from '../contexts/ConsentContext';

type ConsentState = {
  from?: {
    pathname?: string;
  };
};

export function Consent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accept, loading } = useConsent();
  const [understandDataUse, setUnderstandDataUse] = useState(false);
  const [understandEmergencyLimit, setUnderstandEmergencyLimit] = useState(false);
  const [allowProactiveSupport, setAllowProactiveSupport] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = location.state as ConsentState | null;
  const nextPath = state?.from?.pathname?.startsWith('/') ? state.from.pathname : '/chat';
  const canSubmit = understandDataUse && understandEmergencyLimit && !isSubmitting && !loading;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await accept(allowProactiveSupport);
      navigate(nextPath, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Chưa thể lưu xác nhận');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-miru-bg p-4 md:p-8 pb-24 md:pb-8">
      <div className="max-w-2xl mx-auto">
        <div className="glass-panel p-8 md:p-10">
          <div className="w-16 h-16 rounded-3xl bg-miru-primary/20 flex items-center justify-center text-miru-primary mb-6">
            <ShieldCheck size={30} />
          </div>

          <h1 className="text-3xl font-bold mb-3">Xác nhận trước khi sử dụng Miru</h1>
          <p className="text-white/70 mb-8 leading-relaxed">
            Miru có thể xử lý nội dung nhạy cảm liên quan đến tâm lý, ký ức và hỗ trợ trị liệu.
            Trước khi tiếp tục, bạn cần xác nhận hai điều kiện cốt lõi bên dưới.
          </p>

          <div className="space-y-4">
            <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={understandDataUse}
                onChange={(event) => setUnderstandDataUse(event.target.checked)}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">Tôi đồng ý để Miru xử lý dữ liệu cần thiết cho hỗ trợ cá nhân hóa</div>
                <div className="text-sm text-white/60 mt-1">
                  Điều này bao gồm nội dung trò chuyện, trí nhớ ngắn hạn, trí nhớ dài hạn, nhắc nhở chủ động và các tín hiệu phục vụ trị liệu.
                </div>
              </div>
            </label>

            <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={understandEmergencyLimit}
                onChange={(event) => setUnderstandEmergencyLimit(event.target.checked)}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">Tôi hiểu Miru không thay thế cấp cứu hay bác sĩ trực tiếp</div>
                <div className="text-sm text-white/60 mt-1">
                  Nếu có dấu hiệu tự hại, nguy cơ khẩn cấp hoặc tình huống cần can thiệp ngay, tôi sẽ liên hệ người thật và dịch vụ phù hợp.
                </div>
              </div>
            </label>

            <label className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={allowProactiveSupport}
                onChange={(event) => setAllowProactiveSupport(event.target.checked)}
                className="mt-1"
              />
              <div>
                <div className="font-semibold">Cho phép Miru gửi hỗ trợ chủ động</div>
                <div className="text-sm text-white/60 mt-1">
                  Bạn có thể bật các gợi ý nhẹ và thông báo chủ động khi im lặng lâu. Tùy chọn này có thể đổi lại sau.
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="mt-8 w-full glass-button px-5 py-4 rounded-2xl font-semibold disabled:opacity-50"
          >
            {isSubmitting ? 'Đang lưu xác nhận...' : 'Tôi đồng ý và tiếp tục'}
          </button>
        </div>
      </div>
    </div>
  );
}
