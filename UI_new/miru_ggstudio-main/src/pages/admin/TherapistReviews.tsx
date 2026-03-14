import { useEffect, useState } from 'react';
import { ShieldCheck, XCircle } from 'lucide-react';
import {
  approveAdminTherapistReview,
  getAdminTherapistReviewDetail,
  getAdminTherapistReviews,
  rejectAdminTherapistReview,
  type AdminTherapistReviewItem,
  type TherapistVerificationSubmission,
} from '../../services/therapistVerification';

export function AdminTherapistReviewsPage() {
  const [items, setItems] = useState<AdminTherapistReviewItem[]>([]);
  const [activeItem, setActiveItem] = useState<TherapistVerificationSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadList() {
    const response = await getAdminTherapistReviews();
    setItems(response.therapists);
    if (!activeItem && response.therapists[0]?.therapist_id) {
      const detail = await getAdminTherapistReviewDetail(response.therapists[0].therapist_id);
      setActiveItem(detail.submission);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadList();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách xét duyệt');
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

  async function selectItem(therapistId: string) {
    try {
      setError(null);
      const detail = await getAdminTherapistReviewDetail(therapistId);
      setActiveItem(detail.submission);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : 'Không tải được chi tiết xét duyệt');
    }
  }

  async function handleApprove(therapistId: string) {
    try {
      setBusyId(therapistId);
      setError(null);
      const detail = await approveAdminTherapistReview(therapistId);
      setActiveItem(detail.submission);
      await loadList();
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Không duyệt được therapist');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(therapistId: string) {
    try {
      setBusyId(therapistId);
      setError(null);
      const detail = await rejectAdminTherapistReview(
        therapistId,
        'Cần bổ sung giấy phép hành nghề hoặc minh chứng nghề nghiệp rõ ràng hơn.'
      );
      setActiveItem(detail.submission);
      await loadList();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Không từ chối được therapist');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-6xl glass-panel h-96 animate-pulse rounded-[32px] bg-white/5" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="text-xs uppercase tracking-[0.35em] text-white/35">Admin review</div>
          <h1 className="mt-3 text-3xl font-bold">Duyệt hồ sơ nhà trị liệu</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
            Chỉ therapist đã được duyệt mới vào được portal và được xuất hiện trên danh bạ công khai.
          </p>
          {error && (
            <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="glass-panel rounded-[32px] border border-white/10 p-4">
            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                  Chưa có hồ sơ therapist nào để xét duyệt.
                </div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.therapist_id}
                    onClick={() => void selectItem(item.therapist_id)}
                    className={`w-full rounded-[24px] border px-4 py-4 text-left transition-colors ${
                      activeItem?.therapist_id === item.therapist_id
                        ? 'border-miru-primary/60 bg-miru-primary/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-semibold">{item.verification_full_name || item.name || item.email || item.therapist_id}</div>
                    <div className="mt-1 text-sm text-white/55">{item.verification_profession_title || item.email || 'Chưa cập nhật chức danh'}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.25em] text-white/35">
                      {item.verification_status}
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            {!activeItem ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/45">
                Chọn một hồ sơ ở bên trái để xem chi tiết.
              </div>
            ) : (
              <>
                <div className="grid gap-3 text-sm text-white/75">
                  <div><span className="text-white/45">Họ tên:</span> {activeItem.verification_full_name || 'Chưa có'}</div>
                  <div><span className="text-white/45">Chức danh:</span> {activeItem.verification_profession_title || 'Chưa có'}</div>
                  <div><span className="text-white/45">Mã chứng chỉ:</span> {activeItem.verification_license_number || 'Chưa có'}</div>
                  <div><span className="text-white/45">Đơn vị:</span> {activeItem.verification_issuing_organization || 'Chưa có'}</div>
                  <div><span className="text-white/45">Ghi chú:</span> {activeItem.verification_note || 'Không có'}</div>
                </div>

                <div className="mt-6 grid gap-3">
                  {activeItem.documents.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                      Chưa có tài liệu minh chứng.
                    </div>
                  ) : (
                    activeItem.documents.map((document) => (
                      <a
                        key={document.media_id ?? document.id}
                        href={document.url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-colors hover:bg-white/10"
                      >
                        {document.file_name ?? 'Tài liệu minh chứng'}
                      </a>
                    ))
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => void handleApprove(activeItem.therapist_id)}
                    disabled={busyId === activeItem.therapist_id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-100 disabled:opacity-60"
                  >
                    <ShieldCheck size={16} />
                    {busyId === activeItem.therapist_id ? 'Đang duyệt...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => void handleReject(activeItem.therapist_id)}
                    disabled={busyId === activeItem.therapist_id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-red-500/15 px-5 py-3 text-sm font-semibold text-red-100 disabled:opacity-60"
                  >
                    <XCircle size={16} />
                    {busyId === activeItem.therapist_id ? 'Đang xử lý...' : 'Reject'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
