import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  deleteTherapistVerificationDocument,
  getMyTherapistVerification,
  submitTherapistVerification,
  updateMyTherapistVerification,
  uploadTherapistVerificationDocuments,
  type TherapistVerificationSubmission,
} from '../../services/therapistVerification';

function emptySubmission(): TherapistVerificationSubmission {
  return {
    therapist_id: '',
    verification_status: 'not_submitted',
    verification_submitted_at: null,
    verified_at: null,
    verified_by_email: null,
    rejection_reason: null,
    verification_full_name: '',
    verification_profession_title: '',
    verification_license_number: '',
    verification_issuing_organization: '',
    verification_note: '',
    documents: [],
  };
}

export function TherapistApplyPage() {
  const { user, checkAuth } = useAuth();
  const [submission, setSubmission] = useState<TherapistVerificationSubmission>(emptySubmission());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    verification_full_name: '',
    verification_profession_title: '',
    verification_license_number: '',
    verification_issuing_organization: '',
    verification_note: '',
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getMyTherapistVerification();
        if (cancelled) {
          return;
        }
        setSubmission(response.submission);
        setForm({
          verification_full_name: response.submission.verification_full_name ?? '',
          verification_profession_title: response.submission.verification_profession_title ?? '',
          verification_license_number: response.submission.verification_license_number ?? '',
          verification_issuing_organization: response.submission.verification_issuing_organization ?? '',
          verification_note: response.submission.verification_note ?? '',
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Không tải được hồ sơ xét duyệt');
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

  const isRejected = submission.verification_status === 'rejected';
  const isPending = submission.verification_status === 'pending';

  const helperText = useMemo(() => {
    if (isPending) {
      return 'Hồ sơ của bạn đang chờ quản lý chuyên môn xét duyệt. Bạn vẫn có thể cập nhật thông tin nếu cần.';
    }
    if (isRejected) {
      return 'Hồ sơ đã bị từ chối trước đó. Hãy bổ sung minh chứng và gửi lại.';
    }
    return 'Điền thông tin nghề nghiệp và tải lên minh chứng để được duyệt tư cách nhà trị liệu.';
  }, [isPending, isRejected]);

  function setField<Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const response = await updateMyTherapistVerification(form);
      setSubmission(response.submission);
      setMessage('Đã lưu thông tin xét duyệt.');
      await checkAuth();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không lưu được thông tin xét duyệt');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }
    try {
      setUploading(true);
      setError(null);
      setMessage(null);
      const response = await uploadTherapistVerificationDocuments(Array.from(files));
      setSubmission(response.submission);
      setMessage('Đã tải lên minh chứng.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Không tải lên được minh chứng');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(mediaId: string) {
    try {
      setError(null);
      setMessage(null);
      const response = await deleteTherapistVerificationDocument(mediaId);
      setSubmission(response.submission);
      setMessage('Đã xóa minh chứng.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không xóa được minh chứng');
    }
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);
      const response = await submitTherapistVerification();
      setSubmission(response.submission);
      setMessage('Hồ sơ đã được gửi tới quản lý chuyên môn.');
      await checkAuth();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không gửi được hồ sơ xét duyệt');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-4xl animate-pulse space-y-6">
          <div className="glass-panel h-48 rounded-[32px] bg-white/5" />
          <div className="glass-panel h-80 rounded-[32px] bg-white/5" />
        </div>
      </div>
    );
  }

  if (user?.role !== 'therapist') {
    return (
      <div className="min-h-screen px-4 py-10 md:px-8">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-amber-400/30 bg-amber-500/10 px-6 py-8 text-center text-amber-100">
          <p>Trang này chỉ dành cho tài khoản đăng ký với tư cách nhà trị liệu.</p>
          <Link to="/" className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white">
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/35">
                <ShieldCheck size={14} />
                Xét duyệt nhà trị liệu
              </div>
              <h1 className="mt-3 text-3xl font-bold">Xác minh tư cách therapist</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">{helperText}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
              <div className="text-white/55">Trạng thái hiện tại</div>
              <div className="mt-1 font-semibold capitalize">
                {submission.verification_status === 'not_submitted' ? 'Chưa nộp' : submission.verification_status === 'pending' ? 'Đang chờ duyệt' : submission.verification_status === 'approved' ? 'Đã duyệt' : 'Bị từ chối'}
              </div>
            </div>
          </div>

          {submission.rejection_reason && (
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Lý do từ chối: {submission.rejection_reason}
            </div>
          )}

          {message && (
            <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/35">Thông tin nghề nghiệp</div>
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Họ và tên đầy đủ</span>
                <input value={form.verification_full_name} onChange={(event) => setField('verification_full_name', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Chức danh chuyên môn</span>
                <input value={form.verification_profession_title} onChange={(event) => setField('verification_profession_title', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Mã chứng chỉ / giấy phép</span>
                <input value={form.verification_license_number} onChange={(event) => setField('verification_license_number', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Đơn vị cấp / nơi công tác</span>
                <input value={form.verification_issuing_organization} onChange={(event) => setField('verification_issuing_organization', event.target.value)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="grid gap-2">
                <span className="text-sm text-white/70">Ghi chú bổ sung</span>
                <textarea value={form.verification_note} onChange={(event) => setField('verification_note', event.target.value)} rows={5} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
            </div>

            <button onClick={handleSave} disabled={saving} className="mt-6 rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-60">
              {saving ? 'Đang lưu...' : 'Lưu thông tin'}
            </button>
          </section>

          <aside className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/35">Minh chứng nghề nghiệp</div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white/10">
              <FileUp size={18} />
              {uploading ? 'Đang tải...' : 'Tải lên PDF / ảnh'}
              <input type="file" multiple accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void handleUpload(event.target.files)} />
            </label>

            <div className="mt-6 space-y-3">
              {submission.documents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/45">
                  Chưa có minh chứng nào được tải lên.
                </div>
              ) : (
                submission.documents.map((document) => (
                  <div key={document.media_id ?? document.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{document.file_name ?? 'Tài liệu minh chứng'}</div>
                        <div className="mt-1 text-xs text-white/50">
                          {document.mime_type ?? 'Không rõ định dạng'}
                        </div>
                      </div>
                      {document.media_id && (
                        <button onClick={() => void handleDelete(document.media_id ?? '')} className="rounded-xl border border-white/10 p-2 text-white/55 transition-colors hover:text-white">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    {document.url && (
                      <a href={document.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm text-miru-primary hover:underline">
                        Mở tài liệu
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>

            <button onClick={handleSubmit} disabled={submitting || submission.documents.length === 0} className="mt-6 w-full rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {submitting ? 'Đang gửi xét duyệt...' : 'Gửi hồ sơ xét duyệt'}
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
