import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { queryKeys, therapistTreatmentProgramQueryOptions } from '../../queries/appQueries';
import {
  archiveTreatmentProgram,
  createTreatmentGoal,
  createTreatmentSession,
  deleteTreatmentGoal,
  deleteTreatmentSession,
  publishTreatmentProgram,
  type TreatmentGoal,
  type TreatmentSessionPlan,
  updateTreatmentGoal,
  updateTreatmentSession,
  upsertTherapistTreatmentProgram,
} from '../../services/treatmentPrograms';

type GoalDraft = {
  title: string;
  description: string;
  success_criteria: string;
  status: 'not_started' | 'in_progress' | 'achieved' | 'paused';
  order_index: number;
};

type SessionDraft = {
  session_number: number;
  title: string;
  objectives: string;
  interventions: string;
  homework_plan: string;
  status: 'planned' | 'completed' | 'skipped';
  scheduled_for: string;
  appointment_id: string;
  session_note_id: string;
};

function goalToDraft(goal: TreatmentGoal): GoalDraft {
  return {
    title: goal.title ?? '',
    description: goal.description ?? '',
    success_criteria: goal.success_criteria ?? '',
    status: goal.status,
    order_index: goal.order_index ?? 0,
  };
}

function sessionToDraft(session: TreatmentSessionPlan): SessionDraft {
  return {
    session_number: session.session_number,
    title: session.title ?? '',
    objectives: session.objectives ?? '',
    interventions: session.interventions ?? '',
    homework_plan: session.homework_plan ?? '',
    status: session.status,
    scheduled_for: session.scheduled_for ? session.scheduled_for.slice(0, 16) : '',
    appointment_id: session.appointment_id ? String(session.appointment_id) : '',
    session_note_id: session.session_note_id ? String(session.session_note_id) : '',
  };
}

export function TherapistTreatmentPlanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    ...therapistTreatmentProgramQueryOptions(id ?? ''),
    enabled: Boolean(id),
  });

  const [title, setTitle] = useState('');
  const [approachesText, setApproachesText] = useState('');
  const [summary, setSummary] = useState('');
  const [totalSessions, setTotalSessions] = useState('');
  const [startDate, setStartDate] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [goalDrafts, setGoalDrafts] = useState<Record<number, GoalDraft>>({});
  const [sessionDrafts, setSessionDrafts] = useState<Record<number, SessionDraft>>({});
  const [newGoal, setNewGoal] = useState<GoalDraft>({
    title: '',
    description: '',
    success_criteria: '',
    status: 'not_started',
    order_index: 0,
  });
  const [newSession, setNewSession] = useState<SessionDraft>({
    session_number: 1,
    title: '',
    objectives: '',
    interventions: '',
    homework_plan: '',
    status: 'planned',
    scheduled_for: '',
    appointment_id: '',
    session_note_id: '',
  });

  const program = detailQuery.data?.program ?? null;
  const goals = detailQuery.data?.goals ?? [];
  const sessions = detailQuery.data?.sessions ?? [];
  const appointmentOptions = detailQuery.data?.available_appointments ?? [];
  const noteOptions = detailQuery.data?.available_session_notes ?? [];

  useEffect(() => {
    setTitle(program?.title ?? '');
    setApproachesText((program?.approaches ?? []).join(', '));
    setSummary(program?.summary ?? '');
    setTotalSessions(program?.total_sessions ? String(program.total_sessions) : '');
    setStartDate(program?.start_date ?? '');
    setReviewDate(program?.review_date ?? '');
  }, [program?.id, program?.title, program?.approaches, program?.summary, program?.total_sessions, program?.start_date, program?.review_date]);

  useEffect(() => {
    setGoalDrafts(
      goals.reduce<Record<number, GoalDraft>>((acc, goal) => {
        acc[goal.id] = goalToDraft(goal);
        return acc;
      }, {})
    );
    setNewGoal((previous) => ({ ...previous, order_index: goals.length }));
  }, [goals]);

  useEffect(() => {
    setSessionDrafts(
      sessions.reduce<Record<number, SessionDraft>>((acc, session) => {
        acc[session.id] = sessionToDraft(session);
        return acc;
      }, {})
    );
    setNewSession((previous) => ({ ...previous, session_number: sessions.length + 1 }));
  }, [sessions]);

  const invalidatePlanQueries = async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.treatmentPrograms.therapistClient(id ?? ''),
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.treatmentPrograms.clientCurrent(),
    });
  };

  const saveProgramMutation = useMutation({
    mutationFn: () =>
      upsertTherapistTreatmentProgram(id ?? '', {
        title: title.trim() || null,
        approaches: approachesText.split(',').map((item) => item.trim()).filter(Boolean),
        summary: summary.trim() || null,
        total_sessions: totalSessions ? Number(totalSessions) : null,
        start_date: startDate || null,
        review_date: reviewDate || null,
      }),
    onSuccess: () => void invalidatePlanQueries(),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishTreatmentProgram(program!.id),
    onSuccess: () => void invalidatePlanQueries(),
  });

  const archiveMutation = useMutation({
    mutationFn: () => archiveTreatmentProgram(program!.id),
    onSuccess: () => void invalidatePlanQueries(),
  });

  const createGoalMutation = useMutation({
    mutationFn: () => createTreatmentGoal(program!.id, newGoal),
    onSuccess: () => {
      setNewGoal({
        title: '',
        description: '',
        success_criteria: '',
        status: 'not_started',
        order_index: goals.length + 1,
      });
      void invalidatePlanQueries();
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: () =>
      createTreatmentSession(program!.id, {
        ...newSession,
        scheduled_for: newSession.scheduled_for || null,
        appointment_id: newSession.appointment_id ? Number(newSession.appointment_id) : null,
        session_note_id: newSession.session_note_id ? Number(newSession.session_note_id) : null,
      }),
    onSuccess: () => {
      setNewSession({
        session_number: sessions.length + 2,
        title: '',
        objectives: '',
        interventions: '',
        homework_plan: '',
        status: 'planned',
        scheduled_for: '',
        appointment_id: '',
        session_note_id: '',
      });
      void invalidatePlanQueries();
    },
  });

  const isBusy =
    saveProgramMutation.isPending ||
    publishMutation.isPending ||
    archiveMutation.isPending ||
    createGoalMutation.isPending ||
    createSessionMutation.isPending;

  const pageError =
    (detailQuery.error instanceof Error && detailQuery.error.message) ||
    (saveProgramMutation.error instanceof Error && saveProgramMutation.error.message) ||
    (publishMutation.error instanceof Error && publishMutation.error.message) ||
    (archiveMutation.error instanceof Error && archiveMutation.error.message) ||
    (createGoalMutation.error instanceof Error && createGoalMutation.error.message) ||
    (createSessionMutation.error instanceof Error && createSessionMutation.error.message) ||
    null;

  const canManageChildren = Boolean(program?.id);
  const statusLabel = useMemo(() => {
    if (!program) return 'Chưa tạo kế hoạch';
    if (program.status === 'published') return 'Đã publish';
    if (program.status === 'archived') return 'Đã archive';
    return 'Đang là nháp';
  }, [program]);

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <button
        onClick={() => navigate(`/therapist/clients/${id}`)}
        className="mb-6 flex items-center gap-2 text-white/60 transition-colors hover:text-white"
      >
        <ArrowLeft size={18} />
        Quay lại hồ sơ thân chủ
      </button>

      <div className="glass-panel mb-8 p-8">
        <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/45">
          Treatment plan
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Kế hoạch trị liệu theo thân chủ</h1>
            <p className="mt-2 text-sm text-white/60">
              Therapist tạo nháp, cập nhật mục tiêu và nội dung phiên. Client chỉ xem được sau khi bạn publish.
            </p>
          </div>
          <div className="rounded-full bg-white/8 px-4 py-2 text-sm text-white/75">{statusLabel}</div>
        </div>
      </div>

      {pageError && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {pageError}
        </div>
      )}

      {detailQuery.isLoading ? (
        <div className="glass-panel p-8 text-sm text-white/60">
          <div className="flex items-center gap-2">
            <LoaderCircle size={16} className="animate-spin" />
            Đang tải kế hoạch trị liệu...
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">Thông tin chung</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => saveProgramMutation.mutate()}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  <Save size={16} />
                  Lưu nháp
                </button>
                {program?.id && (
                  <>
                    <button
                      onClick={() => publishMutation.mutate()}
                      disabled={isBusy}
                      className="rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Publish
                    </button>
                    <button
                      onClick={() => archiveMutation.mutate()}
                      disabled={isBusy}
                      className="rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-200 disabled:opacity-60"
                    >
                      Archive
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm text-white/60">Tiêu đề chương trình</div>
                <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="block">
                <div className="mb-2 text-sm text-white/60">Liệu pháp / cách tiếp cận</div>
                <input value={approachesText} onChange={(event) => setApproachesText(event.target.value)} placeholder="Ví dụ: CBT, ACT, trị liệu gia đình" className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="block">
                <div className="mb-2 text-sm text-white/60">Số phiên dự kiến</div>
                <input type="number" min={1} value={totalSessions} onChange={(event) => setTotalSessions(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="block">
                <div className="mb-2 text-sm text-white/60">Ngày bắt đầu</div>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="block">
                <div className="mb-2 text-sm text-white/60">Ngày review</div>
                <input type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
              <label className="block md:col-span-2">
                <div className="mb-2 text-sm text-white/60">Tóm tắt chương trình</div>
                <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
              </label>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="glass-panel p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Mục tiêu trị liệu</h2>
                {!canManageChildren && <span className="text-xs text-white/45">Lưu nháp trước để thêm mục tiêu</span>}
              </div>
              <div className="space-y-4">
                {goals.map((goal) => {
                  const draft = goalDrafts[goal.id] ?? goalToDraft(goal);
                  return (
                    <div key={goal.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="grid gap-3">
                        <input value={draft.title} onChange={(event) => setGoalDrafts((previous) => ({ ...previous, [goal.id]: { ...draft, title: event.target.value } }))} className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                        <textarea rows={3} value={draft.description} onChange={(event) => setGoalDrafts((previous) => ({ ...previous, [goal.id]: { ...draft, description: event.target.value } }))} placeholder="Mô tả mục tiêu" className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                        <textarea rows={2} value={draft.success_criteria} onChange={(event) => setGoalDrafts((previous) => ({ ...previous, [goal.id]: { ...draft, success_criteria: event.target.value } }))} placeholder="Tiêu chí thành công" className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                        <div className="grid gap-3 md:grid-cols-2">
                          <select value={draft.status} onChange={(event) => setGoalDrafts((previous) => ({ ...previous, [goal.id]: { ...draft, status: event.target.value as GoalDraft['status'] } }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none">
                            <option value="not_started">Chưa bắt đầu</option>
                            <option value="in_progress">Đang thực hiện</option>
                            <option value="achieved">Đã đạt</option>
                            <option value="paused">Tạm dừng</option>
                          </select>
                          <input type="number" min={0} value={draft.order_index} onChange={(event) => setGoalDrafts((previous) => ({ ...previous, [goal.id]: { ...draft, order_index: Number(event.target.value) } }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => updateTreatmentGoal(program!.id, goal.id, draft).then(() => invalidatePlanQueries())} disabled={isBusy} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">Lưu mục tiêu</button>
                          <button onClick={() => deleteTreatmentGoal(program!.id, goal.id).then(() => invalidatePlanQueries())} disabled={isBusy} className="inline-flex items-center gap-2 rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-medium text-rose-200 disabled:opacity-60"><Trash2 size={15} />Xóa</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-4">
                  <div className="mb-3 text-sm font-medium text-white/70">Thêm mục tiêu mới</div>
                  <div className="grid gap-3">
                    <input value={newGoal.title} onChange={(event) => setNewGoal((previous) => ({ ...previous, title: event.target.value }))} placeholder="Tên mục tiêu" className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                    <textarea rows={3} value={newGoal.description} onChange={(event) => setNewGoal((previous) => ({ ...previous, description: event.target.value }))} placeholder="Mô tả" className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                    <textarea rows={2} value={newGoal.success_criteria} onChange={(event) => setNewGoal((previous) => ({ ...previous, success_criteria: event.target.value }))} placeholder="Tiêu chí thành công" className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                    <button onClick={() => createGoalMutation.mutate()} disabled={!canManageChildren || isBusy || !newGoal.title.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><Plus size={16} />Thêm mục tiêu</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Kế hoạch theo phiên</h2>
                {!canManageChildren && <span className="text-xs text-white/45">Lưu nháp trước để thêm phiên</span>}
              </div>
              <div className="space-y-4">
                {sessions.map((session) => {
                  const draft = sessionDrafts[session.id] ?? sessionToDraft(session);
                  return (
                    <div key={session.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="grid gap-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <input type="number" min={1} value={draft.session_number} onChange={(event) => setSessionDrafts((previous) => ({ ...previous, [session.id]: { ...draft, session_number: Number(event.target.value) } }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                          <select value={draft.status} onChange={(event) => setSessionDrafts((previous) => ({ ...previous, [session.id]: { ...draft, status: event.target.value as SessionDraft['status'] } }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none">
                            <option value="planned">Planned</option>
                            <option value="completed">Completed</option>
                            <option value="skipped">Skipped</option>
                          </select>
                        </div>
                        <input value={draft.title} onChange={(event) => setSessionDrafts((previous) => ({ ...previous, [session.id]: { ...draft, title: event.target.value } }))} placeholder="Tiêu đề phiên" className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                        <textarea rows={2} value={draft.objectives} onChange={(event) => setSessionDrafts((previous) => ({ ...previous, [session.id]: { ...draft, objectives: event.target.value } }))} placeholder="Mục tiêu của phiên" className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                        <textarea rows={2} value={draft.interventions} onChange={(event) => setSessionDrafts((previous) => ({ ...previous, [session.id]: { ...draft, interventions: event.target.value } }))} placeholder="Can thiệp / kỹ thuật" className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                        <textarea rows={2} value={draft.homework_plan} onChange={(event) => setSessionDrafts((previous) => ({ ...previous, [session.id]: { ...draft, homework_plan: event.target.value } }))} placeholder="Bài tập hoặc theo dõi sau phiên" className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                        <div className="grid gap-3 md:grid-cols-3">
                          <input type="datetime-local" value={draft.scheduled_for} onChange={(event) => setSessionDrafts((previous) => ({ ...previous, [session.id]: { ...draft, scheduled_for: event.target.value } }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                          <select value={draft.appointment_id} onChange={(event) => setSessionDrafts((previous) => ({ ...previous, [session.id]: { ...draft, appointment_id: event.target.value } }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none">
                            <option value="">Không gắn lịch hẹn</option>
                            {appointmentOptions.map((option) => <option key={option.id} value={option.id}>{option.appointment_date || `Lịch hẹn #${option.id}`}</option>)}
                          </select>
                          <select value={draft.session_note_id} onChange={(event) => setSessionDrafts((previous) => ({ ...previous, [session.id]: { ...draft, session_note_id: event.target.value } }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none">
                            <option value="">Không gắn session note</option>
                            {noteOptions.map((option) => <option key={option.id} value={option.id}>{option.session_date || `Note #${option.id}`}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-3">
                          <button onClick={() => updateTreatmentSession(program!.id, session.id, { ...draft, scheduled_for: draft.scheduled_for || null, appointment_id: draft.appointment_id ? Number(draft.appointment_id) : null, session_note_id: draft.session_note_id ? Number(draft.session_note_id) : null }).then(() => invalidatePlanQueries())} disabled={isBusy} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">Lưu phiên</button>
                          <button onClick={() => deleteTreatmentSession(program!.id, session.id).then(() => invalidatePlanQueries())} disabled={isBusy} className="inline-flex items-center gap-2 rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-medium text-rose-200 disabled:opacity-60"><Trash2 size={15} />Xóa</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-4">
                  <div className="mb-3 text-sm font-medium text-white/70">Thêm kế hoạch phiên mới</div>
                  <div className="grid gap-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input type="number" min={1} value={newSession.session_number} onChange={(event) => setNewSession((previous) => ({ ...previous, session_number: Number(event.target.value) }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                      <select value={newSession.status} onChange={(event) => setNewSession((previous) => ({ ...previous, status: event.target.value as SessionDraft['status'] }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none">
                        <option value="planned">Planned</option>
                        <option value="completed">Completed</option>
                        <option value="skipped">Skipped</option>
                      </select>
                    </div>
                    <input value={newSession.title} onChange={(event) => setNewSession((previous) => ({ ...previous, title: event.target.value }))} placeholder="Tiêu đề phiên" className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                    <textarea rows={2} value={newSession.objectives} onChange={(event) => setNewSession((previous) => ({ ...previous, objectives: event.target.value }))} placeholder="Mục tiêu của phiên" className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                    <textarea rows={2} value={newSession.interventions} onChange={(event) => setNewSession((previous) => ({ ...previous, interventions: event.target.value }))} placeholder="Can thiệp / kỹ thuật" className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                    <textarea rows={2} value={newSession.homework_plan} onChange={(event) => setNewSession((previous) => ({ ...previous, homework_plan: event.target.value }))} placeholder="Bài tập hoặc theo dõi sau phiên" className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                    <div className="grid gap-3 md:grid-cols-3">
                      <input type="datetime-local" value={newSession.scheduled_for} onChange={(event) => setNewSession((previous) => ({ ...previous, scheduled_for: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none" />
                      <select value={newSession.appointment_id} onChange={(event) => setNewSession((previous) => ({ ...previous, appointment_id: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none">
                        <option value="">Không gắn lịch hẹn</option>
                        {appointmentOptions.map((option) => <option key={option.id} value={option.id}>{option.appointment_date || `Lịch hẹn #${option.id}`}</option>)}
                      </select>
                      <select value={newSession.session_note_id} onChange={(event) => setNewSession((previous) => ({ ...previous, session_note_id: event.target.value }))} className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none">
                        <option value="">Không gắn session note</option>
                        {noteOptions.map((option) => <option key={option.id} value={option.id}>{option.session_date || `Note #${option.id}`}</option>)}
                      </select>
                    </div>
                    <button onClick={() => createSessionMutation.mutate()} disabled={!canManageChildren || isBusy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><Plus size={16} />Thêm phiên</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
