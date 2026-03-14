import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, LoaderCircle, Send } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { myAssessmentDetailQueryOptions, myAssessmentsQueryOptions, queryKeys } from '../queries/appQueries';
import { submitMyAssessment } from '../services/assessments';
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

export function AssessmentTakePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailQuery = useQuery({
    ...(assignmentId ? myAssessmentDetailQueryOptions(assignmentId) : myAssessmentDetailQueryOptions('__missing__')),
    enabled: Boolean(assignmentId),
  });
  const assignment = detailQuery.data?.assignment ?? null;
  const queryError = detailQuery.error instanceof Error ? detailQuery.error.message : null;

  useEffect(() => {
    if (!assignment) {
      return;
    }
    const nextAnswers: Record<string, number> = {};
    for (const answer of assignment.answers) {
      nextAnswers[answer.question_id] = answer.answer_value;
    }
    setAnswers(nextAnswers);
  }, [assignment]);

  const unansweredCount = useMemo(() => {
    if (!assignment) {
      return 0;
    }
    return assignment.questions.filter((question) => typeof answers[question.id] !== 'number').length;
  }, [assignment, answers]);

  async function handleSubmit() {
    if (!assignmentId || !assignment) {
      return;
    }
    if (unansweredCount > 0) {
      setError('Bạn cần trả lời tất cả câu hỏi trước khi nộp.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const payload = assignment.questions.map((question) => ({
        question_id: question.id,
        answer_value: answers[question.id],
      }));
      const response = await submitMyAssessment(assignmentId, payload);
      queryClient.setQueryData(
        myAssessmentDetailQueryOptions(assignmentId).queryKey,
        response
      );
      queryClient.invalidateQueries({ queryKey: myAssessmentsQueryOptions().queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.myAssignments() });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không gửi được bài đánh giá');
    } finally {
      setSubmitting(false);
    }
  }

  if (!assignmentId) {
    return (
      <div className="min-h-screen bg-miru-bg px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-amber-100">
          Thiếu mã bài đánh giá.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-miru-bg px-4 py-8 pb-28 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <button
          onClick={() => navigate('/assessments')}
          className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft size={16} />
          Quay lại danh sách thang đo
        </button>

        {detailQuery.isLoading && (
          <div className="glass-panel flex items-center gap-3 rounded-[28px] border border-white/10 px-5 py-4 text-white/55">
            <LoaderCircle size={18} className="animate-spin" />
            Đang tải bài đánh giá...
          </div>
        )}

        {(error || queryError) && (
          <div className="rounded-[28px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            {error ?? queryError}
          </div>
        )}

        {assignment && (
          <>
            <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.32em] text-white/40">
                    {assignment.template.short_code ?? 'Assessment'}
                  </div>
                  <h1 className="mt-3 text-3xl font-bold">
                    {repairMojibake(assignment.template.name)}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                    {repairMojibake(
                      assignment.template.instructions ??
                        'Hãy chọn mức độ phù hợp nhất với trải nghiệm gần đây của bạn.'
                    )}
                  </p>
                </div>

                <div className="grid gap-3 md:min-w-[240px]">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    <div className="text-white/45">Trạng thái</div>
                    <div className="mt-2 font-semibold text-white">
                      {assignment.status === 'completed' ? 'Đã hoàn thành' : 'Chờ thực hiện'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    <div className="text-white/45">Hạn làm</div>
                    <div className="mt-2 font-semibold text-white">{formatDate(assignment.due_date)}</div>
                  </div>
                </div>
              </div>

              {assignment.therapist_note && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-7 text-white/65">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/40">
                    Ghi chú từ therapist
                  </div>
                  {repairMojibake(assignment.therapist_note)}
                </div>
              )}
            </section>

            {assignment.status === 'completed' && assignment.result ? (
              <section className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
                <div className="glass-panel rounded-[32px] border border-emerald-400/20 bg-emerald-500/10 p-6 md:p-8">
                  <div className="flex items-center gap-3 text-emerald-100">
                    <CheckCircle2 size={22} />
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/80">
                        Kết quả sàng lọc
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {repairMojibake(assignment.result.severity ?? 'Đã có kết quả')}
                      </div>
                    </div>
                  </div>

                  {typeof assignment.result.total_score === 'number' && (
                    <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-black/10 px-4 py-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-emerald-200/75">
                        Tổng điểm
                      </div>
                      <div className="mt-2 text-4xl font-bold text-white">
                        {assignment.result.total_score}
                      </div>
                    </div>
                  )}

                  <p className="mt-6 text-sm leading-7 text-emerald-50/85">
                    {repairMojibake(
                      assignment.result.interpretation ??
                        'Kết quả này mang tính chất sàng lọc tham khảo và cần được therapist diễn giải thêm.'
                    )}
                  </p>

                  <div className="mt-6 text-sm text-emerald-100/80">
                    Hoàn thành ngày {formatDate(assignment.result.completed_at)}
                  </div>
                </div>

                <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Câu trả lời đã nộp</h2>
                    <Link to="/therapy" className="text-sm text-miru-primary hover:underline">
                      Về khu trị liệu
                    </Link>
                  </div>

                  <div className="space-y-4">
                    {assignment.questions.map((question) => {
                      const answer = assignment.answers.find((item) => item.question_id === question.id);
                      return (
                        <div key={question.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                          <div className="text-sm text-white/45">Câu {question.order_index}</div>
                          <div className="mt-2 text-base font-medium text-white">
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
              <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Bộ câu hỏi</h2>
                    <p className="mt-2 text-sm text-white/60">
                      Còn {unansweredCount} câu chưa trả lời. Bạn có thể chọn một đáp án cho mỗi câu trước khi nộp.
                    </p>
                  </div>

                  <button
                    onClick={() => void handleSubmit()}
                    disabled={submitting || unansweredCount > 0}
                    className="inline-flex items-center gap-2 rounded-2xl bg-miru-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                    {submitting ? 'Đang nộp...' : 'Nộp bài đánh giá'}
                  </button>
                </div>

                <div className="space-y-4">
                  {assignment.questions.map((question) => (
                    <div key={question.id} className="rounded-[28px] border border-white/10 bg-white/5 px-4 py-5 md:px-5">
                      <div className="text-sm text-white/45">Câu {question.order_index}</div>
                      <div className="mt-2 text-base font-medium leading-7 text-white">
                        {repairMojibake(question.prompt)}
                      </div>
                      <div className="mt-4 grid gap-3">
                        {question.choices.map((choice) => {
                          const selected = answers[question.id] === choice.value;
                          return (
                            <button
                              key={`${question.id}-${choice.value}`}
                              type="button"
                              onClick={() =>
                                setAnswers((current) => ({
                                  ...current,
                                  [question.id]: choice.value,
                                }))
                              }
                              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                                selected
                                  ? 'border-miru-primary/60 bg-miru-primary/15 text-white'
                                  : 'border-white/10 bg-black/10 text-white/70 hover:bg-white/10'
                              }`}
                            >
                              {repairMojibake(choice.label)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
