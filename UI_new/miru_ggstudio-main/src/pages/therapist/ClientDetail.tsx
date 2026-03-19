import { type ComponentType, type ReactNode, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  CalendarClock,
  CalendarPlus,
  ClipboardList,
  LoaderCircle,
  MessageCircle,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { repairMojibake } from '../../lib/text';
import { useAuth } from '../../contexts/AuthContext';
import { createTherapistAssignment } from '../../services/backend';
import type { TherapistAssignment, TherapistClientSummary } from '../../services/contracts';
import {
  therapistClientAssignmentsQueryOptions,
  therapistClientSummaryQueryOptions,
  therapistClientsQueryOptions,
} from '../../queries/appQueries';

type TherapistClientRow = Record<string, unknown>;
type ChecklistDraftItem = { id: string; label: string };

const nextChecklistId = () => `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function cleanText(value?: string | null, fallback = '') {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return repairMojibake(value).trim();
}

function getClientName(client: TherapistClientRow | null, fallbackId: string) {
  const nested = client?.users;
  if (nested && typeof nested === 'object') {
    const user = nested as Record<string, unknown>;
    if (typeof user.name === 'string' && user.name.trim()) return cleanText(user.name, fallbackId);
  }
  return fallbackId;
}

function getClientEmail(client: TherapistClientRow | null) {
  const nested = client?.users;
  if (nested && typeof nested === 'object') {
    const user = nested as Record<string, unknown>;
    if (typeof user.email === 'string' && user.email.trim()) return user.email;
  }
  return 'Chưa có email';
}

function formatDateTime(value?: string | null, fallback = 'Chưa có dữ liệu') {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAssignmentType(value?: string | null) {
  switch ((value || '').toLowerCase()) {
    case 'exercise':
      return 'Bài thực hành';
    case 'reading':
      return 'Đọc tài liệu';
    case 'journal':
      return 'Viết nhật ký';
    case 'meditation':
      return 'Thực hành thư giãn';
    case 'task':
      return 'Công việc';
    default:
      return 'Khác';
  }
}

function formatAssignmentStatus(value?: string | null) {
  switch ((value || '').toLowerCase()) {
    case 'completed':
      return 'Đã hoàn thành';
    case 'in_progress':
      return 'Đang thực hiện';
    case 'overdue':
      return 'Quá hạn';
    default:
      return 'Chờ thực hiện';
  }
}

function formatPriority(value?: string | null) {
  switch ((value || '').toLowerCase()) {
    case 'high':
      return 'cao';
    case 'low':
      return 'thấp';
    default:
      return 'trung bình';
  }
}

function progressWidth(value?: number | null) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0%';
  return `${Math.min(100, Math.max(0, numeric))}%`;
}

function getAttentionBadgeClass(level?: string | null) {
  switch ((level || '').toLowerCase()) {
    case 'high':
      return 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200';
    case 'medium':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200';
  }
}

function getAttentionLabel(level?: string | null) {
  switch ((level || '').toLowerCase()) {
    case 'high':
      return 'Cần chú ý cao';
    case 'medium':
      return 'Cần theo dõi';
    default:
      return 'Ổn định';
  }
}

function getActionHref(clientId: string, action?: string | null) {
  const normalized = cleanText(action).toLowerCase();
  if (normalized.includes('nhắn')) return `/therapist/messages?client=${encodeURIComponent(clientId)}`;
  if (normalized.includes('assessment')) {
    return `/therapist/clients/${encodeURIComponent(clientId)}/assessments`;
  }
  if (normalized.includes('lịch')) return `/therapist/appointments?client=${encodeURIComponent(clientId)}`;
  if (normalized.includes('chia sẻ')) return `/therapist/clients/${encodeURIComponent(clientId)}/context`;
  return `/therapist/clients/${encodeURIComponent(clientId)}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-miru-primary/10 text-miru-primary">
        <Icon size={18} />
      </div>
      <p className="mb-2 text-sm text-slate-500 dark:text-white/50">{label}</p>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function SummaryCard({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  children: ReactNode;
}) {
  const Icon = icon;
  return (
    <section className="glass-panel rounded-3xl border border-white/10 p-6">
      <div className="mb-4 flex items-start gap-3">
        {Icon ? <Icon size={18} className="mt-1 text-miru-primary" /> : null}
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-white/35">{eyebrow}</div>
          <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export function TherapistClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const therapistId = user?.id ?? '';
  const clientId = id ?? '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignmentType, setAssignmentType] = useState('exercise');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [checklistItems, setChecklistItems] = useState<ChecklistDraftItem[]>([
    { id: nextChecklistId(), label: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientsQuery = useQuery({
    ...therapistClientsQueryOptions(therapistId),
    enabled: Boolean(therapistId),
  });
  const summaryQuery = useQuery({
    ...therapistClientSummaryQueryOptions(therapistId, clientId),
    enabled: Boolean(therapistId && clientId),
  });
  const assignmentsQuery = useQuery({
    ...therapistClientAssignmentsQueryOptions(therapistId, clientId),
    enabled: Boolean(therapistId && clientId),
  });

  const client =
    ((clientsQuery.data?.clients ?? []) as TherapistClientRow[]).find((item) => {
      if (typeof item.client_id === 'string') return item.client_id === clientId;
      if (typeof item.id === 'string') return item.id === clientId;
      return false;
    }) ?? null;

  const summary = (summaryQuery.data?.summary ?? null) as TherapistClientSummary | null;
  const assignments = (assignmentsQuery.data?.assignments ?? []) as TherapistAssignment[];
  const clientName = getClientName(client, clientId || 'Thân chủ');
  const clientEmail = getClientEmail(client);
  const isLoading = clientsQuery.isLoading || summaryQuery.isLoading || assignmentsQuery.isLoading;

  const cleanedChecklistItems = useMemo(
    () =>
      checklistItems
        .map((item) => ({ id: item.id, label: item.label.trim() }))
        .filter((item) => item.label),
    [checklistItems]
  );

  function addChecklistItem() {
    setChecklistItems((prev) => [...prev, { id: nextChecklistId(), label: '' }]);
  }

  function removeChecklistItem(idToRemove: string) {
    setChecklistItems((prev) => {
      const nextItems = prev.filter((item) => item.id !== idToRemove);
      return nextItems.length > 0 ? nextItems : [{ id: nextChecklistId(), label: '' }];
    });
  }

  function updateChecklistItem(idToUpdate: string, label: string) {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === idToUpdate ? { ...item, label } : item))
    );
  }

  async function handleCreateAssignment() {
    if (!therapistId || !clientId || !title.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await createTherapistAssignment(therapistId, {
        client_id: clientId,
        title: title.trim(),
        description: description.trim(),
        type: assignmentType,
        priority,
        due_date: dueDate || undefined,
        checklist_items: cleanedChecklistItems,
      });

      if (response.assignment) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: therapistClientAssignmentsQueryOptions(therapistId, clientId).queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: therapistClientSummaryQueryOptions(therapistId, clientId).queryKey,
          }),
        ]);
      }

      setTitle('');
      setDescription('');
      setAssignmentType('exercise');
      setPriority('medium');
      setDueDate('');
      setChecklistItems([{ id: nextChecklistId(), label: '' }]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không tạo được bài tập');
    } finally {
      setIsSubmitting(false);
    }
  }

  const queryError =
    error ??
    (clientsQuery.error instanceof Error
      ? clientsQuery.error.message
      : summaryQuery.error instanceof Error
        ? summaryQuery.error.message
        : assignmentsQuery.error instanceof Error
          ? assignmentsQuery.error.message
          : null);

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <button
        onClick={() => navigate('/therapist/clients')}
        className="mb-6 flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900 dark:text-white/60 dark:hover:text-white"
      >
        <ArrowLeft size={20} />
        Quay lại danh sách
      </button>

      <section className="glass-panel mb-8 flex flex-col gap-6 p-8 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10 bg-miru-primary/20 text-3xl font-bold text-miru-primary">
            {clientName.charAt(0)}
          </div>
          <div>
            <h1 className="mb-1 text-3xl font-bold text-slate-900 dark:text-white">{clientName}</h1>
            <p className="mb-2 text-slate-600 dark:text-white/60">
              {clientEmail} • ID: {clientId}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/therapist/clients/${clientId}/treatment-plan`)}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-800 dark:bg-white/8 dark:text-white"
          >
            <ClipboardList size={16} />
            Kế hoạch trị liệu
          </button>
          <button
            onClick={() => navigate(`/therapist/clients/${clientId}/context`)}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-800 dark:bg-white/8 dark:text-white"
          >
            <Brain size={16} />
            Bối cảnh AI
          </button>
          <button
            onClick={() => navigate(`/therapist/clients/${clientId}/assessments`)}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-800 dark:bg-white/8 dark:text-white"
          >
            <Sparkles size={16} />
            Thang đo
          </button>
          <button
            onClick={() => navigate(`/therapist/messages?client=${clientId}`)}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-800 dark:bg-white/8 dark:text-white"
          >
            <MessageCircle size={16} />
            Nhắn tin
          </button>
          <button
            onClick={() => navigate(`/therapist/appointments?client=${clientId}`)}
            className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-800 dark:bg-white/8 dark:text-white"
          >
            <CalendarPlus size={16} />
            Tạo lịch hẹn
          </button>
        </div>
      </section>

      {queryError ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          {cleanText(queryError, 'Không tải được chi tiết thân chủ')}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-white/40">
          <LoaderCircle size={16} className="animate-spin" />
          Đang tải dữ liệu thân chủ
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              icon={Activity}
              label="Tổng số phiên"
              value={summary?.total_sessions ?? 0}
            />
            <StatCard
              icon={ClipboardList}
              label="Mục cần xử lý"
              value={summary?.pending_items_count ?? 0}
            />
            <StatCard
              icon={MessageCircle}
              label="Tin nhắn chưa đọc"
              value={summary?.unread_client_messages ?? 0}
            />
            <StatCard
              icon={AlertTriangle}
              label="Cảnh báo mở"
              value={summary?.open_crisis_count ?? 0}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SummaryCard eyebrow="Trajectory" title="Quỹ đạo hiện tại">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-base font-medium text-slate-900 dark:text-white">
                  {cleanText(summary?.trajectory_state, 'Đang cần theo dõi thêm')}
                </p>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${getAttentionBadgeClass(summary?.attention_level)}`}
                >
                  {getAttentionLabel(summary?.attention_level)}
                </span>
              </div>
              <p className="text-sm leading-7 text-slate-600 dark:text-white/60">
                {summary?.share_access_enabled
                  ? 'Miru đang dùng dữ liệu được chia sẻ để rút tín hiệu hỗ trợ liên tục cho ca này.'
                  : 'Hiện Miru chỉ hiển thị tín hiệu vận hành vì thân chủ chưa bật chia sẻ sâu.'}
              </p>
            </SummaryCard>

            <SummaryCard
              eyebrow="Since Last Review"
              title="Thay đổi gần đây"
              icon={CalendarClock}
            >
              <p className="text-sm leading-7 text-slate-700 dark:text-white/70">
                {cleanText(
                  summary?.trend_summary,
                  'Miru chưa có đủ dữ liệu để tóm tắt thay đổi mới.'
                )}
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-white/55">
                <div>
                  Hoạt động gần nhất của thân chủ:{' '}
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatDateTime(summary?.last_client_activity_at)}
                  </span>
                </div>
                <div>
                  Hành động therapist gần nhất:{' '}
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatDateTime(summary?.last_therapist_action_at)}
                  </span>
                </div>
              </div>
            </SummaryCard>

            <SummaryCard
              eyebrow="Recommended Next Action"
              title="Hành động gợi ý"
              icon={Sparkles}
            >
              <p className="text-base font-medium text-slate-900 dark:text-white">
                {cleanText(summary?.suggested_next_action, 'Xem summary ca')}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-white/70">
                {cleanText(
                  summary?.attention_reason,
                  'Miru chưa phát hiện tín hiệu ưu tiên cao. Bạn có thể tiếp tục theo dõi ca như bình thường.'
                )}
              </p>
              <div className="mt-4 text-sm text-slate-600 dark:text-white/55">
                Lịch gần nhất:{' '}
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatDateTime(summary?.next_appointment_at, 'Chưa có lịch hẹn')}
                </span>
              </div>
              <button
                onClick={() =>
                  navigate(getActionHref(clientId, summary?.suggested_next_action))
                }
                className="mt-5 inline-flex rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-miru-primary/85"
              >
                {cleanText(summary?.suggested_next_action, 'Xem summary ca')}
              </button>
            </SummaryCard>
          </div>

          <section className="glass-panel rounded-3xl border border-white/10 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Bài tập đã giao
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-white/45">
                  Theo dõi checklist, hạn hoàn thành và sản phẩm thân chủ đã nộp.
                </p>
              </div>
              <span className="text-sm text-slate-500 dark:text-white/40">
                {assignments.length} mục
              </span>
            </div>

            <div className="space-y-4">
              {assignments.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                  Chưa có bài tập nào cho thân chủ này.
                </div>
              ) : (
                assignments.map((assignment) => (
                  <div
                    key={String(assignment.id ?? assignment.title ?? assignment.created_at ?? 'assignment')}
                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-medium text-slate-900 dark:text-white">
                            {cleanText(assignment.title, 'Bài tập')}
                          </h4>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-white/10 dark:text-white/70">
                            {formatAssignmentType(assignment.type)}
                          </span>
                          <span className="rounded-full bg-miru-primary/15 px-3 py-1 text-xs text-miru-primary">
                            Ưu tiên {formatPriority(assignment.priority)}
                          </span>
                        </div>
                        {assignment.description ? (
                          <p className="mt-2 text-sm text-slate-700 dark:text-white/65">
                            {cleanText(assignment.description)}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-white/80">
                        {formatAssignmentStatus(assignment.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-black/15 dark:text-white/70">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-white/40">
                          Tiến độ
                        </div>
                        <div className="mt-2 font-medium">
                          {assignment.completed_steps}/{assignment.total_steps} bước
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-black/15 dark:text-white/70">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-white/40">
                          Hạn hoàn thành
                        </div>
                        <div className="mt-2 font-medium">
                          {assignment.due_date || 'Không có hạn'}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:bg-black/15 dark:text-white/70">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-white/40">
                          Sản phẩm nộp
                        </div>
                        <div className="mt-2 font-medium">
                          {assignment.submission_attachments.length} tệp
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-white/50">
                        <span>Hoàn thành {assignment.progress_percent}%</span>
                        {assignment.is_overdue ? (
                          <span className="text-amber-500 dark:text-amber-300">Đã quá hạn</span>
                        ) : null}
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-white/8">
                        <div
                          className="h-2 rounded-full bg-miru-primary transition-all"
                          style={{ width: progressWidth(assignment.progress_percent) }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="glass-panel h-fit rounded-3xl border border-white/10 p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Giao bài tập mới
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-white/55">
              Thân chủ có thể nộp sản phẩm bằng Word (DOC/DOCX), PDF, MP3/M4A, MP4 hoặc ảnh PNG/JPG.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tiêu đề bài tập"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
            />

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Mô tả và hướng dẫn cho thân chủ..."
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={assignmentType}
                onChange={(event) => setAssignmentType(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="exercise">Bài thực hành</option>
                <option value="reading">Đọc tài liệu</option>
                <option value="journal">Viết nhật ký</option>
                <option value="meditation">Thực hành thư giãn</option>
                <option value="task">Công việc</option>
                <option value="other">Khác</option>
              </select>

              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
              </select>
            </div>

            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
            />

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    Checklist từng bước
                  </div>
                  <div className="text-sm text-slate-500 dark:text-white/45">
                    Các bước này sẽ được thân chủ đánh dấu tiến độ khi thực hiện.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                >
                  <Plus size={16} />
                  Thêm bước
                </button>
              </div>

              <div className="space-y-3">
                {checklistItems.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="w-7 shrink-0 text-sm text-slate-400 dark:text-white/40">
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      value={item.label}
                      onChange={(event) => updateChecklistItem(item.id, event.target.value)}
                      placeholder="Ví dụ: Viết 3 dòng về cảm xúc hôm nay"
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-miru-primary/50 focus:outline-none dark:border-white/10 dark:bg-black/15 dark:text-white dark:placeholder:text-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id)}
                      className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => void handleCreateAssignment()}
              disabled={!title.trim() || isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-miru-primary py-3 font-medium text-white disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <Plus size={18} />}
              Giao bài tập
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
