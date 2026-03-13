import { useState } from 'react';
import { AlertTriangle, HeartHandshake, ShieldCheck } from 'lucide-react';
import { useConsent } from '../contexts/ConsentContext';

export function ConsentGate() {
  const { accept } = useConsent();
  const [understandDataUse, setUnderstandDataUse] = useState(false);
  const [understandEmergencyLimit, setUnderstandEmergencyLimit] = useState(false);
  const [allowProactiveSupport, setAllowProactiveSupport] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = understandDataUse && understandEmergencyLimit && !submitting;

  async function handleAccept() {
    if (!canContinue) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await accept(allowProactiveSupport);
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : 'Không thể lưu chấp thuận lúc này.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-miru-bg px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.25)] overflow-hidden">
        <div className="p-8 md:p-10 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(127,13,242,0.22),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/70">
            <ShieldCheck size={16} />
            Chấp thuận trước khi tiếp tục
          </div>
          <h1 className="mt-5 text-3xl md:text-4xl font-bold text-white">Một cam kết ngắn trước khi dùng Miru</h1>
          <p className="mt-3 text-white/70 leading-relaxed max-w-2xl">
            Để bảo vệ bạn tốt hơn, Miru cần xác nhận rằng bạn hiểu cách AI hỗ trợ, cách dữ liệu được dùng,
            và giới hạn của ứng dụng trong các tình huống khẩn cấp.
          </p>
        </div>

        <div className="p-8 md:p-10 space-y-5">
          <label className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={understandDataUse}
              onChange={(event) => setUnderstandDataUse(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-transparent text-miru-primary"
            />
            <div>
              <div className="flex items-center gap-2 text-white font-semibold">
                <HeartHandshake size={18} className="text-miru-primary" />
                Tôi đồng ý để Miru xử lý nội dung trò chuyện và dữ liệu liên quan để tạo hỗ trợ cá nhân hóa
              </div>
              <p className="mt-2 text-sm text-white/65">
                Điều này bao gồm trí nhớ ngắn hạn, trí nhớ dài hạn, nhắc nhở chủ động và các tín hiệu phục vụ hỗ trợ trị liệu.
              </p>
            </div>
          </label>

          <label className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={understandEmergencyLimit}
              onChange={(event) => setUnderstandEmergencyLimit(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-transparent text-miru-primary"
            />
            <div>
              <div className="flex items-center gap-2 text-white font-semibold">
                <AlertTriangle size={18} className="text-amber-300" />
                Tôi hiểu Miru không thay thế cấp cứu hay bác sĩ trực tiếp
              </div>
              <p className="mt-2 text-sm text-white/65">
                Nếu có nguy cơ tự hại, cấp cứu hoặc tình huống cần can thiệp ngay, tôi sẽ liên hệ người thật và dịch vụ khẩn cấp phù hợp.
              </p>
            </div>
          </label>

          <label className="flex gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={allowProactiveSupport}
              onChange={(event) => setAllowProactiveSupport(event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-transparent text-miru-primary"
            />
            <div>
              <div className="text-white font-semibold">Cho phép Miru gửi hỗ trợ chủ động</div>
              <p className="mt-2 text-sm text-white/65">
                Tùy chọn này bật các nhắc nhở nhẹ và thông báo hỗ trợ khi bạn im lặng trong thời gian dài. Bạn có thể đổi lại sau.
              </p>
            </div>
          </label>

          {error && (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-2">
            <p className="text-sm text-white/45">
              Khi bấm tiếp tục, bạn xác nhận đã đọc và chấp thuận phiên bản cam kết hiện tại.
            </p>
            <button
              onClick={handleAccept}
              disabled={!canContinue}
              className="rounded-2xl bg-miru-primary px-6 py-3 font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition-all"
            >
              {submitting ? 'Đang lưu chấp thuận...' : 'Tôi đồng ý và tiếp tục'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
