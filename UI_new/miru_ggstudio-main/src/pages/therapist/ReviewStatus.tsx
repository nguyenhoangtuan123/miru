import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Clock3, ShieldCheck, XCircle } from 'lucide-react';
import { getMyTherapistVerification, type TherapistVerificationSubmission } from '../../services/therapistVerification';

export function TherapistReviewStatusPage() {
  const [submission, setSubmission] = useState<TherapistVerificationSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getMyTherapistVerification();
        if (!cancelled) {
          setSubmission(response.submission);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được trạng thái xét duyệt');
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

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-3xl glass-panel h-64 animate-pulse rounded-[32px] bg-white/5" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-amber-400/30 bg-amber-500/10 px-6 py-8 text-center text-amber-100">
          <p>{error || 'Không tìm thấy trạng thái xét duyệt'}</p>
          <Link to="/therapist/apply" className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white">
            Đi tới hồ sơ xét duyệt
          </Link>
        </div>
      </div>
    );
  }

  const isApproved = submission.verification_status === 'approved';
  const isRejected = submission.verification_status === 'rejected';

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-3xl rounded-[32px] border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-miru-primary/20 text-miru-primary">
          {isApproved ? <ShieldCheck size={28} /> : isRejected ? <XCircle size={28} /> : <Clock3 size={28} />}
        </div>

        <h1 className="mt-6 text-3xl font-bold">
          {isApproved ? 'Tài khoản therapist đã được duyệt' : isRejected ? 'Hồ sơ xét duyệt cần bổ sung' : 'Hồ sơ đang chờ xét duyệt'}
        </h1>

        <p className="mt-4 text-sm leading-7 text-white/65">
          {isApproved
            ? 'Bạn đã có thể truy cập khu therapist và hiển thị hồ sơ công khai khi bật chế độ công khai.'
            : isRejected
              ? `Lý do gần nhất: ${submission.rejection_reason || 'Quản lý chuyên môn cần thêm minh chứng.'}`
              : 'Quản lý chuyên môn sẽ xem xét hồ sơ minh chứng trước khi mở quyền therapist portal cho bạn.'}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {isApproved ? (
            <Link to="/therapist" className="rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white">
              Vào therapist portal
            </Link>
          ) : (
            <Link to="/therapist/apply" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white">
              {isRejected ? 'Bổ sung hồ sơ' : 'Xem hồ sơ đã nộp'}
            </Link>
          )}
          <Link to="/" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white">
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
