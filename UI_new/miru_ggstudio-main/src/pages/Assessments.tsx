import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, LoaderCircle, TimerReset } from 'lucide-react';
import { Link } from 'react-router-dom';
import { myAssessmentsQueryOptions } from '../queries/appQueries';
import { repairMojibake } from '../lib/text';

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
      return 'Chờ thực hiện';
  }
}

export function AssessmentsPage() {
  const assessmentsQuery = useQuery(myAssessmentsQueryOptions());
  const assignments = assessmentsQuery.data?.assignments ?? [];
  const pendingAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status !== 'completed'),
    [assignments]
  );
  const completedAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'completed'),
    [assignments]
  );

  return (
    <div className="min-h-screen bg-miru-bg px-4 py-8 pb-28 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-white/40">
                Đánh giá tâm lý
              </div>
              <h1 className="mt-3 text-3xl font-bold">Các thang đo therapist đã giao</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                Tại đây bạn có thể làm PHQ-9, GAD-7, DASS-21 và xem lại kết quả sàng lọc sau khi nộp.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:min-w-[280px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-2xl font-bold">{pendingAssignments.length}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">Đang chờ</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-2xl font-bold">{completedAssignments.length}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/45">Đã xong</div>
              </div>
            </div>
          </div>
        </section>

        {assessmentsQuery.isLoading && (
          <div className="glass-panel flex items-center gap-3 rounded-[28px] border border-white/10 px-5 py-4 text-white/55">
            <LoaderCircle size={18} className="animate-spin" />
            Đang tải danh sách thang đo...
          </div>
        )}

        {assessmentsQuery.error instanceof Error && (
          <div className="rounded-[28px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            {assessmentsQuery.error.message}
          </div>
        )}

        {!assessmentsQuery.isLoading && assignments.length === 0 && (
          <div className="glass-panel rounded-[32px] border border-dashed border-white/10 px-6 py-10 text-center text-white/50">
            Therapist của bạn chưa giao thang đo nào ở thời điểm này.
          </div>
        )}

        {assignments.length > 0 && (
          <div className="grid gap-4">
            {assignments.map((assignment) => {
              const isCompleted = assignment.status === 'completed';
              return (
                <Link
                  key={assignment.id}
                  to={`/assessments/${assignment.id}`}
                  className="glass-panel rounded-[28px] border border-white/10 p-5 transition-transform duration-200 hover:-translate-y-1 hover:bg-white/10"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/70">
                          {assignment.template_short_code ?? assignment.template_name ?? 'Assessment'}
                        </div>
                        <div
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isCompleted
                              ? 'bg-emerald-500/15 text-emerald-200'
                              : 'bg-sky-500/15 text-sky-200'
                          }`}
                        >
                          {statusLabel(assignment.status)}
                        </div>
                      </div>

                      <div>
                        <h2 className="text-xl font-semibold">
                          {repairMojibake(assignment.template_name ?? 'Thang đo tâm lý')}
                        </h2>
                        <p className="mt-1 text-sm text-white/55">
                          Giao bởi {repairMojibake(assignment.therapist_name ?? 'therapist của bạn')}
                        </p>
                      </div>

                      {assignment.therapist_note && (
                        <p className="max-w-3xl text-sm leading-7 text-white/65">
                          {repairMojibake(assignment.therapist_note)}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-3 md:min-w-[240px]">
                      <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/70">
                        <div className="flex items-center gap-2 text-white/50">
                          <TimerReset size={14} />
                          Hạn làm
                        </div>
                        <div className="mt-2 font-semibold text-white">{formatDate(assignment.due_date)}</div>
                      </div>

                      {assignment.result ? (
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={15} />
                            {repairMojibake(assignment.result.severity ?? 'Đã có kết quả')}
                          </div>
                          {typeof assignment.result.total_score === 'number' && (
                            <div className="mt-2 text-xs uppercase tracking-[0.18em] text-emerald-200/80">
                              Điểm: {assignment.result.total_score}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/55">
                          Mở thang đo để điền câu trả lời và xem kết quả sàng lọc.
                        </div>
                      )}

                      <div className="inline-flex items-center gap-2 text-sm font-medium text-miru-primary">
                        {isCompleted ? 'Xem kết quả' : 'Bắt đầu làm'}
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!assessmentsQuery.isLoading && assignments.length > 0 && (
          <section className="glass-panel rounded-[28px] border border-white/10 p-5 text-sm leading-7 text-white/55">
            <div className="mb-3 flex items-center gap-2 text-white">
              <ClipboardList size={18} />
              Lưu ý
            </div>
            Kết quả ở đây là kết quả sàng lọc tham khảo. Therapist sẽ kết hợp thêm phỏng vấn và bối cảnh thực tế trước khi đưa ra đánh giá chuyên môn cuối cùng.
          </section>
        )}
      </div>
    </div>
  );
}
