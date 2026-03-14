import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Plus,
  Send,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  assessmentTemplatesQueryOptions,
  queryKeys,
  therapistClientAssessmentsQueryOptions,
  therapistClientsQueryOptions,
} from '../../queries/appQueries';
import { createAssessmentAssignment } from '../../services/assessments';
import { repairMojibake } from '../../lib/text';

type TherapistClientRow = Record<string, unknown>;

function getClientName(client: TherapistClientRow | null, fallbackId: string) {
  if (client) {
    const nested = client.users;
    if (nested && typeof nested === 'object') {
      const user = nested as Record<string, unknown>;
      if (typeof user.name === 'string' && user.name.trim()) {
        return repairMojibake(user.name);
      }
    }
  }
  return fallbackId;
}

function getClientEmail(client: TherapistClientRow | null) {
  if (client) {
    const nested = client.users;
    if (nested && typeof nested === 'object') {
      const user = nested as Record<string, unknown>;
      if (typeof user.email === 'string' && user.email.trim()) {
        return user.email;
      }
    }
  }
  return 'Chưa có email';
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Chưa đặt';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('vi-VN');
}

function statusLabel(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return 'Đã hoàn thành';
    case 'cancelled':
      return 'Đã hủy';
    default:
      return 'Đang chờ';
  }
}

export function TherapistClientAssessmentsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const therapistId = user?.id ?? '';
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [therapistNote, setTherapistNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clientsQuery = useQuery({
    ...therapistClientsQueryOptions(therapistId),
    enabled: Boolean(therapistId),
  });
  const templatesQuery = useQuery(assessmentTemplatesQueryOptions());
  const assessmentsQuery = useQuery({
    ...(id
      ? therapistClientAssessmentsQueryOptions(therapistId, id)
      : therapistClientAssessmentsQueryOptions(therapistId, '__missing__')),
    enabled: Boolean(therapistId && id),
  });

  const client =
    ((clientsQuery.data?.clients ?? []) as TherapistClientRow[]).find((item) => {
      if (typeof item.client_id === 'string') {
        return item.client_id === id;
      }
      if (typeof item.id === 'string') {
        return item.id === id;
      }
      return false;
    }) ?? null;
  const templates = templatesQuery.data?.templates ?? [];
  const assignments = assessmentsQuery.data?.assignments ?? [];
  const clientsError = clientsQuery.error instanceof Error ? clientsQuery.error.message : null;
  const templatesError = templatesQuery.error instanceof Error ? templatesQuery.error.message : null;
  const assessmentsError = assessmentsQuery.error instanceof Error ? assessmentsQuery.error.message : null;

  useEffect(() => {
    if (!selectedTemplateId && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [selectedTemplateId, templates]);

  const pendingCount = useMemo(
    () => assignments.filter((assignment) => assignment.status !== 'completed').length,
    [assignments]
  );
  const completedCount = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'completed').length,
    [assignments]
  );

  async function handleAssign() {
    if (!id || !selectedTemplateId) {
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      await createAssessmentAssignment({
        client_id: id,
        template_id: selectedTemplateId,
        due_date: dueDate || null,
        therapist_note: therapistNote.trim() || null,
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.assessments.therapistClientAssignments(therapistId, id),
      });
      setSuccess('Đã giao thang đo cho thân chủ.');
      setTherapistNote('');
      setDueDate('');
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : 'Không giao được thang đo');
    } finally {
      setSubmitting(false);
    }
  }

  if (!id) {
    return (
      <div className="p-6 md:p-10">
        <div className="rounded-[28px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-amber-100">
          Thiếu mã thân chủ.
        </div>
      </div>
    );
  }

  const clientName = getClientName(client, id);
  const clientEmail = getClientEmail(client);

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <button
        onClick={() => navigate(`/therapist/clients/${id}`)}
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
      >
        <ArrowLeft size={16} />
        Quay lại chi tiết thân chủ
      </button>

      <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.32em] text-white/40">
              Assessment
            </div>
            <h1 className="mt-3 text-3xl font-bold">Đánh giá cho {clientName}</h1>
            <p className="mt-3 text-sm leading-7 text-white/60">{clientEmail}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:min-w-[280px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">Đang chờ</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="text-2xl font-bold">{completedCount}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">Đã có kết quả</div>
            </div>
          </div>
        </div>
      </section>

      {(error || success || clientsError || templatesError || assessmentsError) && (
        <div
          className={`mt-6 rounded-[28px] px-5 py-4 text-sm ${
            error || clientsError || templatesError || assessmentsError
              ? 'border border-amber-400/30 bg-amber-500/10 text-amber-100'
              : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          {error ?? clientsError ?? templatesError ?? assessmentsError ?? success}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="mb-5 flex items-center gap-2 text-white">
            <Plus size={18} />
            <h2 className="text-xl font-semibold">Giao thang đo mới</h2>
          </div>

          {templatesQuery.isLoading ? (
            <div className="flex items-center gap-3 text-white/55">
              <LoaderCircle size={18} className="animate-spin" />
              Đang tải bộ thang đo...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3">
                {templates.map((template) => {
                  const active = selectedTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`rounded-[24px] border px-4 py-4 text-left transition-colors ${
                        active
                          ? 'border-miru-primary/55 bg-miru-primary/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {repairMojibake(template.short_code ?? template.name)}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/45">
                            {template.question_count ?? 0} câu hỏi
                          </div>
                        </div>
                        {active && <CheckCircle2 size={18} className="text-miru-primary" />}
                      </div>
                      <p className="mt-3 text-sm leading-7 text-white/60">
                        {repairMojibake(template.description ?? '')}
                      </p>
                    </button>
                  );
                })}
              </div>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Hạn hoàn thành</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-white/70">Lời nhắn cho thân chủ</span>
                <textarea
                  rows={5}
                  value={therapistNote}
                  onChange={(event) => setTherapistNote(event.target.value)}
                  placeholder="Ví dụ: làm trước buổi hẹn tới để mình cùng xem kết quả và trao đổi."
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleAssign()}
                disabled={submitting || !selectedTemplateId}
                className="inline-flex items-center gap-2 rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                {submitting ? 'Đang giao...' : 'Giao thang đo'}
              </button>
            </div>
          )}
        </section>

        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="mb-5 flex items-center gap-2 text-white">
            <ClipboardList size={18} />
            <h2 className="text-xl font-semibold">Lịch sử đánh giá</h2>
          </div>

          {assessmentsQuery.isLoading ? (
            <div className="flex items-center gap-3 text-white/55">
              <LoaderCircle size={18} className="animate-spin" />
              Đang tải lịch sử đánh giá...
            </div>
          ) : assignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-white/45">
              Chưa có thang đo nào được giao cho thân chủ này.
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => {
                const completed = assignment.status === 'completed';
                return (
                  <div key={assignment.id} className="rounded-[28px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/65">
                            {repairMojibake(
                              assignment.template_short_code ?? assignment.template_name ?? 'Assessment'
                            )}
                          </div>
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              completed
                                ? 'bg-emerald-500/15 text-emerald-200'
                                : 'bg-sky-500/15 text-sky-200'
                            }`}
                          >
                            {statusLabel(assignment.status)}
                          </div>
                        </div>

                        <div className="mt-3 text-sm leading-7 text-white/60">
                          Giao ngày {formatDate(assignment.assigned_at)}
                        </div>

                        {assignment.result && (
                          <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                            <div>{repairMojibake(assignment.result.severity ?? 'Đã có kết quả')}</div>
                            {typeof assignment.result.total_score === 'number' && (
                              <div className="mt-1 text-xs uppercase tracking-[0.16em] text-emerald-200/80">
                                Tổng điểm: {assignment.result.total_score}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="grid gap-3 md:min-w-[220px]">
                        <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/65">
                          <div className="flex items-center gap-2 text-white/45">
                            <CalendarDays size={14} />
                            Hạn làm
                          </div>
                          <div className="mt-2 font-semibold text-white">{formatDate(assignment.due_date)}</div>
                        </div>

                        <Link
                          to={`/therapist/clients/${id}/assessments/${assignment.id}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                        >
                          {completed ? 'Xem kết quả chi tiết' : 'Xem tiến độ'}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
