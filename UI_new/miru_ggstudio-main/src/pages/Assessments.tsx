import { useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  LoaderCircle,
  NotebookPen,
  TimerReset,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  assessmentTemplatesQueryOptions,
  myAssessmentsQueryOptions,
  queryKeys,
} from '../queries/appQueries';
import {
  createSelfAssessmentAssignment,
  type AssessmentAssignmentSummary,
  type AssessmentTemplate,
} from '../services/assessments';
import { repairMojibake } from '../lib/text';

const SELF_TEST_CODES = ['PHQ-9', 'GAD-7', 'DASS-21'];

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

function sourceLabel(source?: string | null) {
  return source === 'self_initiated' ? 'Tự làm' : 'Therapist đã giao';
}

function AssignmentCard({ assignment }: { assignment: AssessmentAssignmentSummary }) {
  const isCompleted = assignment.status === 'completed';
  const isSelfInitiated = assignment.source === 'self_initiated';

  return (
    <Link
      to={`/assessments/${assignment.id}`}
      className="glass-panel block overflow-hidden rounded-[28px] border border-white/10 p-5 transition-transform duration-200 hover:-translate-y-1 hover:bg-white/10"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/70">
              {assignment.template_short_code ?? assignment.template_name ?? 'Assessment'}
            </div>
            <div className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-white/70">
              {sourceLabel(assignment.source)}
            </div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isCompleted ? 'bg-emerald-500/15 text-emerald-200' : 'bg-sky-500/15 text-sky-200'
              }`}
            >
              {statusLabel(assignment.status)}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white">
              {repairMojibake(assignment.template_name ?? 'Thang đo tâm lý')}
            </h2>
            <p className="text-sm text-white/55">
              {isSelfInitiated
                ? 'Bạn đã tự khởi tạo bài đánh giá này để theo dõi bản thân.'
                : `Giao bởi ${repairMojibake(assignment.therapist_name ?? 'therapist của bạn')}`}
            </p>
          </div>

          {assignment.therapist_note && !isSelfInitiated ? (
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm leading-7 text-white/70">
              {repairMojibake(assignment.therapist_note)}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/70">
            <div className="flex items-center gap-2 text-white/50">
              <TimerReset size={14} />
              {isSelfInitiated ? 'Khởi tạo' : 'Hạn làm'}
            </div>
            <div className="mt-2 font-semibold text-white">
              {isSelfInitiated ? formatDate(assignment.assigned_at) : formatDate(assignment.due_date)}
            </div>
          </div>

          {assignment.result ? (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} />
                {repairMojibake(assignment.result.severity ?? 'Đã có kết quả')}
              </div>
              {typeof assignment.result.total_score === 'number' ? (
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-emerald-200/80">
                  Điểm: {assignment.result.total_score}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/55">
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
}

function SelfTestLibraryCard({
  template,
  isCreating,
  onCreate,
}: {
  template: AssessmentTemplate;
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="glass-panel h-full rounded-[28px] border border-white/10 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-miru-primary/15 text-miru-primary">
          <NotebookPen size={22} />
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-white/40">
            {template.short_code ?? 'Self-test'}
          </div>
          <h3 className="mt-1 text-xl font-semibold text-white">{repairMojibake(template.name)}</h3>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-white/65">
        {repairMojibake(
          template.description ??
            'Một bài sàng lọc ngắn giúp Miru có thêm tín hiệu để phản chiếu trạng thái gần đây của bạn.'
        )}
      </p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/70">
        {typeof template.question_count === 'number'
          ? `${template.question_count} câu hỏi`
          : 'Bộ câu hỏi ngắn, hoàn thành trong vài phút'}
      </div>

      <button
        onClick={onCreate}
        disabled={isCreating}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isCreating ? <LoaderCircle size={16} className="animate-spin" /> : <FileSearch size={16} />}
        {isCreating ? 'Đang tạo...' : 'Tự làm ngay'}
      </button>
    </div>
  );
}

function SectionShell({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="glass-panel relative overflow-hidden rounded-[32px] border border-white/10 p-6 md:p-8">
      <div className="mb-5 flex items-start gap-3">
        <div className="mt-1 text-miru-primary">{icon}</div>
        <div>
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-white/55">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function AssessmentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const assessmentsQuery = useQuery(myAssessmentsQueryOptions());
  const templatesQuery = useQuery(assessmentTemplatesQueryOptions());

  const createSelfMutation = useMutation({
    mutationFn: createSelfAssessmentAssignment,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments.myAssignments() });
      navigate(`/assessments/${response.assignment.id}`);
    },
  });

  const assignments = assessmentsQuery.data?.assignments ?? [];
  const therapistAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.source !== 'self_initiated'),
    [assignments]
  );
  const selfAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.source === 'self_initiated'),
    [assignments]
  );
  const pendingAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status !== 'completed'),
    [assignments]
  );
  const completedAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'completed'),
    [assignments]
  );
  const selfTemplates = useMemo(() => {
    const templates = templatesQuery.data?.templates ?? [];
    return templates
      .filter((template) => SELF_TEST_CODES.includes((template.short_code ?? '').toUpperCase()))
      .sort(
        (left, right) =>
          SELF_TEST_CODES.indexOf((left.short_code ?? '').toUpperCase()) -
          SELF_TEST_CODES.indexOf((right.short_code ?? '').toUpperCase())
      );
  }, [templatesQuery.data?.templates]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-miru-bg px-4 py-8 pb-28 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="glass-panel relative overflow-hidden rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.32em] text-white/40">Đánh giá tâm lý</div>
              <h1 className="mt-3 text-3xl font-bold">Tự làm hoặc nhận thang đo từ therapist</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
                Bạn có thể tự làm PHQ-9, GAD-7, DASS-21 để theo dõi bản thân, đồng thời vẫn giữ riêng
                luồng thang đo mà therapist đã giao.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:min-w-[320px]">
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

        {templatesQuery.error instanceof Error ? (
          <div className="rounded-[28px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            {templatesQuery.error.message}
          </div>
        ) : null}

        <SectionShell
          icon={<NotebookPen size={18} />}
          title="Tự làm"
          description="Bắt đầu một bài sàng lọc ngắn để Miru có thêm dữ liệu phản chiếu hành trình của bạn."
        >
          {templatesQuery.isLoading ? (
            <div className="flex items-center gap-3 rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-white/55">
              <LoaderCircle size={18} className="animate-spin" />
              Đang tải thư viện self-test...
            </div>
          ) : selfTemplates.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-white/50">
              Chưa có self-test nào sẵn sàng ở thời điểm này.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {selfTemplates.map((template) => (
                <div key={template.id}>
                  <SelfTestLibraryCard
                    template={template}
                    isCreating={
                      createSelfMutation.isPending &&
                      createSelfMutation.variables?.template_id === template.id
                    }
                    onCreate={() => createSelfMutation.mutate({ template_id: template.id })}
                  />
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        {assessmentsQuery.isLoading ? (
          <div className="glass-panel flex items-center gap-3 rounded-[28px] border border-white/10 px-5 py-4 text-white/55">
            <LoaderCircle size={18} className="animate-spin" />
            Đang tải danh sách thang đo...
          </div>
        ) : null}

        {assessmentsQuery.error instanceof Error ? (
          <div className="rounded-[28px] border border-amber-400/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
            {assessmentsQuery.error.message}
          </div>
        ) : null}

        <SectionShell
          icon={<ClipboardList size={18} />}
          title="Therapist đã giao"
          description="Các thang đo therapist muốn bạn hoàn thành để theo dõi quá trình hỗ trợ."
        >
          {therapistAssignments.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-white/50">
              Therapist của bạn chưa giao thang đo nào ở thời điểm này.
            </div>
          ) : (
            <div className="grid gap-4">
              {therapistAssignments.map((assignment) => (
                <div key={assignment.id}>
                  <AssignmentCard assignment={assignment} />
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        <SectionShell
          icon={<FileSearch size={18} />}
          title="Lịch sử tự làm"
          description="Những bài tự đánh giá của riêng bạn, không tự động chia sẻ cho therapist."
        >
          {selfAssignments.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/10 bg-white/5 px-6 py-10 text-center text-white/50">
              Bạn chưa tự làm bài đánh giá nào.
            </div>
          ) : (
            <div className="grid gap-4">
              {selfAssignments.map((assignment) => (
                <div key={assignment.id}>
                  <AssignmentCard assignment={assignment} />
                </div>
              ))}
            </div>
          )}
        </SectionShell>

        {assignments.length > 0 ? (
          <section className="glass-panel rounded-[28px] border border-white/10 p-5 text-sm leading-7 text-white/55">
            <div className="mb-3 flex items-center gap-2 text-white">
              <ClipboardList size={18} />
              Lưu ý
            </div>
            Kết quả ở đây là kết quả sàng lọc tham khảo. Miru dùng chúng như một tín hiệu bổ sung để
            hiểu bạn theo thời gian, chứ không phải kết luận chẩn đoán.
          </section>
        ) : null}
      </div>
    </div>
  );
}
