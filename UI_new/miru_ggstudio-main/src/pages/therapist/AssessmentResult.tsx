import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { therapistAssessmentDetailQueryOptions } from '../../queries/appQueries';
import { repairMojibake } from '../../lib/text';

function formatDate(value?: string | null) {
  if (!value) {
    return 'Chưa có';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('vi-VN');
}

export function TherapistAssessmentResultPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const therapistId = user?.id ?? '';
  const detailQuery = useQuery({
    ...(id && assignmentId
      ? therapistAssessmentDetailQueryOptions(therapistId, id, assignmentId)
      : therapistAssessmentDetailQueryOptions(therapistId, '__missing__', '__missing__')),
    enabled: Boolean(therapistId && id && assignmentId),
  });
  const assignment = detailQuery.data?.assignment ?? null;
  const queryError = detailQuery.error instanceof Error ? detailQuery.error.message : null;

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <button
        onClick={() => navigate(id ? `/therapist/clients/${id}/assessments` : '/therapist/clients')}
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
      >
        <ArrowLeft size={16} />
        Quay lại danh sách assessment
      </button>

      {detailQuery.isLoading && (
        <div className="glass-panel flex items-center gap-3 rounded-[28px] border border-white/10 px-5 py-4 text-white/55">
          <LoaderCircle size={18} className="animate-spin" />
          Đang tải kết quả assessment...
        </div>
      )}

      {queryError && (
        <div className="rounded-[28px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          {queryError}
        </div>
      )}

      {assignment && (
        <div className="space-y-6">
          <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.32em] text-white/40">
                  {assignment.template.short_code ?? 'Assessment'}
                </div>
                <h1 className="mt-3 text-3xl font-bold">
                  {repairMojibake(assignment.template.name)}
                </h1>
                <p className="mt-3 text-sm leading-7 text-white/60">
                  Giao ngày {formatDate(assignment.assigned_at)} • Hạn làm {formatDate(assignment.due_date)}
                </p>
              </div>

              <div
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  assignment.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-200'
                    : 'bg-sky-500/15 text-sky-200'
                }`}
              >
                {assignment.status === 'completed' ? 'Đã hoàn thành' : 'Đang chờ thân chủ thực hiện'}
              </div>
            </div>

            {assignment.therapist_note && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-7 text-white/65">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/40">
                  Ghi chú đã gửi
                </div>
                {repairMojibake(assignment.therapist_note)}
              </div>
            )}
          </section>

          {assignment.status === 'completed' && assignment.result ? (
            <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
              <div className="glass-panel rounded-[32px] border border-emerald-400/20 bg-emerald-500/10 p-6 md:p-8">
                <div className="flex items-center gap-3 text-emerald-100">
                  <CheckCircle2 size={22} />
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/75">
                      Kết quả sàng lọc
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {repairMojibake(assignment.result.severity ?? 'Đã có kết quả')}
                    </div>
                  </div>
                </div>

                {typeof assignment.result.total_score === 'number' && (
                  <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-black/10 px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Tổng điểm</div>
                    <div className="mt-2 text-4xl font-bold text-white">{assignment.result.total_score}</div>
                  </div>
                )}

                <p className="mt-6 text-sm leading-7 text-emerald-50/85">
                  {repairMojibake(
                    assignment.result.interpretation ??
                      'Kết quả này mang tính chất sàng lọc và cần được kết hợp với đánh giá lâm sàng.'
                  )}
                </p>

                <div className="mt-6 text-sm text-emerald-100/80">
                  Hoàn thành ngày {formatDate(assignment.result.completed_at)}
                </div>

                {assignment.result.subscale_scores &&
                  Object.keys(assignment.result.subscale_scores).length > 0 && (
                    <div className="mt-6 space-y-3">
                      {Object.entries(assignment.result.subscale_scores).map(([key, value]) => {
                        const record = value as Record<string, unknown>;
                        return (
                          <div key={key} className="rounded-2xl border border-emerald-300/20 bg-black/10 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">
                              {repairMojibake(key)}
                            </div>
                            <div className="mt-2 text-sm text-white">
                              {record.score ?? '-'} điểm • {repairMojibake(String(record.severity ?? ''))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>

              <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Câu trả lời chi tiết</h2>
                  <Link
                    to={`/therapist/clients/${id}`}
                    className="text-sm text-miru-primary transition-colors hover:text-white"
                  >
                    Về hồ sơ thân chủ
                  </Link>
                </div>

                <div className="space-y-4">
                  {assignment.questions.map((question) => {
                    const answer = assignment.answers.find((item) => item.question_id === question.id);
                    return (
                      <div key={question.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                        <div className="text-sm text-white/45">Câu {question.order_index}</div>
                        <div className="mt-2 text-base font-medium leading-7 text-white">
                          {repairMojibake(question.prompt)}
                        </div>
                        <div className="mt-3 text-sm text-white/65">
                          {repairMojibake(answer?.choice_label ?? 'Chưa có câu trả lời')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : (
            <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8 text-sm leading-7 text-white/60">
              Thân chủ chưa nộp assessment này. Sau khi hoàn thành, kết quả sàng lọc và câu trả lời chi tiết sẽ xuất hiện tại đây.
            </section>
          )}
        </div>
      )}
    </div>
  );
}
