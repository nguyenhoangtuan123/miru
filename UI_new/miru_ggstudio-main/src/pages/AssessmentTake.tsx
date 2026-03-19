import { useEffect, useRef, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  Lock,
  Send,
  Share2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  clientTherapistQueryOptions,
  myAssessmentDetailQueryOptions,
  myAssessmentsQueryOptions,
  myTherapistSharingPreferencesQueryOptions,
  queryKeys,
} from '../queries/appQueries';
import { submitMyAssessment } from '../services/assessments';
import { trackMyTrajectoryEvent } from '../services/trajectory';
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

function ShareAssessmentPrompt({
  therapistName,
  onOpenSharing,
}: {
  therapistName?: string | null;
  onOpenSharing: () => void;
}) {
  return (
    <div className="mt-6 rounded-[28px] border border-sky-400/30 bg-sky-500/10 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-200">
          <Share2 size={18} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">Bạn muốn chia sẻ kết quả này với therapist không?</h3>
          <p className="mt-2 text-sm leading-7 text-sky-50/85">
            Kết quả self-test hiện vẫn là riêng tư. Nếu muốn, bạn có thể bật chia sẻ mục{' '}
            <strong>Kết quả thang đo</strong>
            {therapistName ? ` cho ${therapistName}` : ''} trong phần cài đặt chia sẻ.
          </p>
          <button
            onClick={onOpenSharing}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950"
          >
            Mở phần chia sẻ
            <Share2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AssessmentTakePage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selfTestStartedTrackedRef = useRef(false);

  const detailQuery = useQuery({
    ...(assignmentId
      ? myAssessmentDetailQueryOptions(assignmentId)
      : myAssessmentDetailQueryOptions('__missing__')),
    enabled: Boolean(assignmentId),
  });
  const assignment = detailQuery.data?.assignment ?? null;
  const queryError = detailQuery.error instanceof Error ? detailQuery.error.message : null;
  const isSelfInitiated = assignment?.source === 'self_initiated';
  const isCompleted = assignment?.status === 'completed';

  const therapistQuery = useQuery({
    ...(user?.id ? clientTherapistQueryOptions(user.id) : clientTherapistQueryOptions('__missing__')),
    enabled: Boolean(user?.id && isSelfInitiated),
  });
  const sharingQuery = useQuery({
    ...myTherapistSharingPreferencesQueryOptions(),
    enabled: Boolean(user?.id && isSelfInitiated && isCompleted),
  });

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

  useEffect(() => {
    if (!assignment || !isSelfInitiated || isCompleted || selfTestStartedTrackedRef.current) {
      return;
    }
    selfTestStartedTrackedRef.current = true;
    void trackMyTrajectoryEvent({
      event_type: 'self_test_started',
      metadata: {
        assignment_id: assignment.id,
        template_id: assignment.template_id,
        template_name: assignment.template.name,
      },
    }).catch(() => undefined);
  }, [assignment, isCompleted, isSelfInitiated]);

  const unansweredCount = useMemo(() => {
    if (!assignment) {
      return 0;
    }
    return assignment.questions.filter((question) => typeof answers[question.id] !== 'number').length;
  }, [assignment, answers]);

  const pairing = therapistQuery.data?.pairing ?? null;
  const pairedTherapistId =
    typeof pairing?.therapist_id === 'string' && pairing.therapist_id.trim()
      ? pairing.therapist_id
      : null;
  const pairedTherapistName =
    pairedTherapistId && pairing?.therapist && typeof pairing.therapist === 'object'
      ? repairMojibake(
          (typeof pairing.therapist.name === 'string' && pairing.therapist.name) ||
            (typeof pairing.therapist.display_name === 'string' && pairing.therapist.display_name) ||
            ''
        )
      : null;
  const matchedPreference = (sharingQuery.data?.preferences ?? []).find(
    (preference) => preference.therapist_id === pairedTherapistId
  );
  const assessmentAccess = matchedPreference?.assessment_access ?? 'none';
  const shouldPromptSharing = Boolean(isSelfInitiated && isCompleted && pairedTherapistId && assessmentAccess === 'none');

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
      queryClient.setQueryData(myAssessmentDetailQueryOptions(assignmentId).queryKey, response);
      queryClient.invalidateQueries({ queryKey: myAssessmentsQueryOptions().queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.myAssignments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.trajectory.summary() });
      if (isSelfInitiated) {
        void trackMyTrajectoryEvent({
          event_type: 'self_test_completed',
          metadata: {
            assignment_id: response.assignment.id,
            template_id: response.assignment.template_id,
            template_name: response.assignment.template.name,
            severity: response.assignment.result?.severity ?? null,
            total_score: response.assignment.result?.total_score ?? null,
          },
        }).catch(() => undefined);
      }
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

        {detailQuery.isLoading ? (
          <div className="glass-panel flex items-center gap-3 rounded-[28px] border border-white/10 px-5 py-4 text-white/55">
            <LoaderCircle size={18} className="animate-spin" />
            Đang tải bài đánh giá...
          </div>
        ) : null}

        {error || queryError ? (
          <div className="rounded-[28px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            {error ?? queryError}
          </div>
        ) : null}

        {assignment ? (
          <>
            <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.26em] text-white/40">
                    <span>{assignment.template.short_code ?? 'Assessment'}</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] tracking-[0.18em] text-white/60">
                      {isSelfInitiated ? 'Tự làm' : 'Therapist đã giao'}
                    </span>
                  </div>
                  <h1 className="mt-3 text-3xl font-bold">{repairMojibake(assignment.template.name)}</h1>
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
                    <div className="text-white/45">{isSelfInitiated ? 'Khởi tạo' : 'Hạn làm'}</div>
                    <div className="mt-2 font-semibold text-white">
                      {formatDate(isSelfInitiated ? assignment.assigned_at : assignment.due_date)}
                    </div>
                  </div>
                </div>
              </div>

              {assignment.therapist_note && !isSelfInitiated ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm leading-7 text-white/65">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-white/40">
                    Ghi chú từ therapist
                  </div>
                  {repairMojibake(assignment.therapist_note)}
                </div>
              ) : null}

              {isSelfInitiated ? (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-4 text-sm text-white/70">
                  <Lock size={18} className="mt-1 shrink-0 text-white/55" />
                  <div>
                    Kết quả self-test mặc định là riêng tư. Miru chỉ dùng nó như một tín hiệu bổ sung để
                    phản chiếu hành trình của bạn.
                  </div>
                </div>
              ) : null}
            </section>

            {assignment.status === 'completed' && assignment.result ? (
              <>
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

                    {typeof assignment.result.total_score === 'number' ? (
                      <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-black/10 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.22em] text-emerald-200/75">
                          Tổng điểm
                        </div>
                        <div className="mt-2 text-4xl font-bold text-white">
                          {assignment.result.total_score}
                        </div>
                      </div>
                    ) : null}

                    <p className="mt-6 text-sm leading-7 text-emerald-50/85">
                      {repairMojibake(
                        assignment.result.interpretation ??
                          'Kết quả này mang tính chất sàng lọc tham khảo và cần được diễn giải thêm theo bối cảnh thực tế.'
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

                {shouldPromptSharing ? (
                  <ShareAssessmentPrompt
                    therapistName={pairedTherapistName}
                    onOpenSharing={() => navigate('/sharing')}
                  />
                ) : null}
              </>
            ) : (
              <section className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Bộ câu hỏi</h2>
                    <p className="mt-2 text-sm text-white/60">
                      Còn {unansweredCount} câu chưa trả lời. Bạn có thể chọn một đáp án cho mỗi câu trước
                      khi nộp.
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
                    <div
                      key={question.id}
                      className="rounded-[28px] border border-white/10 bg-white/5 px-4 py-5 md:px-5"
                    >
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
        ) : null}
      </div>
    </div>
  );
}
