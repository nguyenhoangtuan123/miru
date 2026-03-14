import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Brain,
  CalendarPlus,
  ClipboardList,
  LoaderCircle,
  MessageCircle,
  Plus,
  Route,
  Trash2,
} from 'lucide-react';
import { repairMojibake } from '../../lib/text';
import { useAuth } from '../../contexts/AuthContext';
import {
  createTherapistAssignment,
} from '../../services/backend';
import type { TherapistAssignment } from '../../services/contracts';
import {
  therapistClientAssignmentsQueryOptions,
  therapistClientSummaryQueryOptions,
  therapistClientsQueryOptions,
} from '../../queries/appQueries';

type TherapistClientRow = Record<string, unknown>;

type ChecklistDraftItem = {
  id: string;
  label: string;
};

function vi(text: string) {
  return repairMojibake(text);
}

function nextChecklistId() {
  return `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getClientName(client: TherapistClientRow | null, fallbackId: string) {
  if (client) {
    const nested = client.users;
    if (nested && typeof nested === 'object') {
      const user = nested as Record<string, unknown>;
      if (typeof user.name === 'string' && user.name.trim()) {
        return vi(user.name);
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

function formatAssignmentStatus(status?: string | null) {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return 'Đã hoàn thành';
    case 'in_progress':
      return 'Đang thực hiện';
    case 'cancelled':
      return 'Đã hủy';
    case 'skipped':
      return 'Đã bỏ qua';
    default:
      return 'Chờ bắt đầu';
  }
}

function formatPriority(priority?: string | null) {
  switch ((priority || '').toLowerCase()) {
    case 'high':
      return 'Cao';
    case 'low':
      return 'Thấp';
    default:
      return 'Trung bình';
  }
}

function formatAssignmentType(type?: string | null) {
  switch ((type || '').toLowerCase()) {
    case 'exercise':
      return 'Bài thực hành';
    case 'reading':
      return 'Đọc tài liệu';
    case 'journal':
      return 'Viết nhật ký';
    case 'meditation':
      return 'Thực hành thư giãn';
    case 'other':
      return 'Khác';
    default:
      return 'Công việc';
  }
}

function getProgressWidth(progress?: number) {
  const safe = Number.isFinite(progress) ? Number(progress) : 0;
  return `${Math.max(0, Math.min(100, safe))}%`;
}

export function TherapistClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
  const therapistId = user?.id ?? '';
  const clientsQuery = useQuery({
    ...therapistClientsQueryOptions(therapistId),
    enabled: Boolean(user?.id),
  });
  const summaryQuery = useQuery({
    ...therapistClientSummaryQueryOptions(therapistId, id ?? ''),
    enabled: Boolean(user?.id && id),
  });
  const assignmentsQuery = useQuery({
    ...therapistClientAssignmentsQueryOptions(therapistId, id ?? ''),
    enabled: Boolean(user?.id && id),
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
  const assignments = (assignmentsQuery.data?.assignments ?? []) as TherapistAssignment[];
  const summary = summaryQuery.data?.summary ?? null;
  const isLoading =
    clientsQuery.isLoading || summaryQuery.isLoading || assignmentsQuery.isLoading;

  const cleanedChecklistItems = useMemo(
    () =>
      checklistItems
        .map((item) => ({
          id: item.id,
          label: item.label.trim(),
        }))
        .filter((item) => item.label),
    [checklistItems]
  );

  async function handleCreateAssignment() {
    if (!user?.id || !id || !title.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const response = await createTherapistAssignment(user.id, {
        client_id: id,
        title: title.trim(),
        description: description.trim(),
        type: assignmentType,
        priority,
        due_date: dueDate || undefined,
        checklist_items: cleanedChecklistItems,
      });

      if (response.assignment) {
        queryClient.invalidateQueries({
          queryKey: therapistClientAssignmentsQueryOptions(user.id, id).queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: therapistClientSummaryQueryOptions(user.id, id).queryKey,
        });
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

  function updateChecklistItem(itemId: string, value: string) {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, label: value } : item))
    );
  }

  function addChecklistItem() {
    setChecklistItems((prev) => [...prev, { id: nextChecklistId(), label: '' }]);
  }

  function removeChecklistItem(itemId: string) {
    setChecklistItems((prev) => {
      if (prev.length === 1) {
        return [{ id: nextChecklistId(), label: '' }];
      }
      return prev.filter((item) => item.id !== itemId);
    });
  }

  const clientName = getClientName(client, id ?? 'Thân chủ');
  const clientEmail = getClientEmail(client);
  const clientStatus = client && typeof client.status === 'string' ? client.status : 'active';

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <button
        onClick={() => navigate('/therapist/clients')}
        className="mb-6 flex items-center gap-2 text-white/60 transition-colors hover:text-white"
      >
        <ArrowLeft size={20} />
        Quay lại danh sách
      </button>

      <div className="glass-panel mb-8 flex flex-col items-start justify-between gap-6 p-8 xl:flex-row xl:items-center">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/10 bg-miru-primary/20 text-3xl font-bold text-miru-primary">
            {clientName.charAt(0)}
          </div>
          <div>
            <h1 className="mb-1 text-3xl font-bold">{clientName}</h1>
            <p className="mb-2 text-white/60">
              {clientEmail} | ID: {id}
            </p>
            <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-400">
              {clientStatus}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/therapist/clients/${id}/treatment-plan`)}
            className="flex items-center gap-2 rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/12"
          >
            <Route size={16} />
            Kế hoạch trị liệu
          </button>
          <button
            onClick={() => navigate(`/therapist/clients/${id}/context`)}
            className="flex items-center gap-2 rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/12"
          >
            <Brain size={16} />
            Bối cảnh AI
          </button>
          <button
            onClick={() => navigate(`/therapist/clients/${id}/assessments`)}
            className="flex items-center gap-2 rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/12"
          >
            <ClipboardList size={16} />
            Thang đo
          </button>
          <button
            onClick={() => navigate(`/therapist/messages?client=${id}`)}
            className="flex items-center gap-2 rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/12"
          >
            <MessageCircle size={16} />
            Nhắn tin
          </button>
          <button
            onClick={() => navigate(`/therapist/appointments?client=${id}`)}
            className="flex items-center gap-2 rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/12"
          >
            <CalendarPlus size={16} />
            Tạo lịch hẹn
          </button>
        </div>
      </div>

      {(error || clientsQuery.error || summaryQuery.error || assignmentsQuery.error) && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error ??
            (clientsQuery.error instanceof Error
              ? clientsQuery.error.message
              : summaryQuery.error instanceof Error
                ? summaryQuery.error.message
                : assignmentsQuery.error instanceof Error
                  ? assignmentsQuery.error.message
                  : 'Không tải được chi tiết thân chủ')}
        </div>
      )}

      {isLoading && (
        <div className="mb-6 flex items-center gap-2 text-sm text-white/40">
          <LoaderCircle size={16} className="animate-spin" />
          Đang tải dữ liệu thân chủ
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Tổng số phiên', value: summary?.total_sessions ?? 0, icon: Activity },
              {
                label: 'Bài tập hoàn thành',
                value: summary?.completed_assignments ?? 0,
                icon: ClipboardList,
              },
              {
                label: 'Bài tập đang theo dõi',
                value: summary?.pending_assignments ?? 0,
                icon: ClipboardList,
              },
              {
                label: 'Cảnh báo AI',
                value: summary?.crisis_events ?? 0,
                icon: Activity,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="glass-panel rounded-2xl p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8">
                    <Icon size={18} className="text-miru-primary" />
                  </div>
                  <p className="mb-2 text-sm text-white/50">{item.label}</p>
                  <p className="text-3xl font-bold">{item.value}</p>
                </div>
              );
            })}
          </div>

          <div className="glass-panel rounded-3xl p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Bài tập đã giao</h2>
                <p className="mt-1 text-sm text-white/45">
                  Theo dõi tiến độ checklist, hạn hoàn thành và sản phẩm mà thân chủ đã nộp.
                </p>
              </div>
              <span className="text-sm text-white/40">{assignments.length} mục</span>
            </div>

            <div className="space-y-4">
              {assignments.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
                  Chưa có bài tập nào cho thân chủ này.
                </div>
              ) : (
                assignments.map((assignment) => (
                  <div
                    key={String(assignment.id ?? assignment.title)}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-medium">{vi(String(assignment.title ?? 'Bài tập'))}</h4>
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                            {formatAssignmentType(assignment.type)}
                          </span>
                          <span className="rounded-full bg-miru-primary/15 px-3 py-1 text-xs text-miru-primary">
                            Ưu tiên {formatPriority(assignment.priority)}
                          </span>
                        </div>
                        {assignment.description && (
                          <p className="mt-2 text-sm text-white/65">{vi(assignment.description)}</p>
                        )}
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                        {formatAssignmentStatus(assignment.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-white/70">
                        <div className="text-xs uppercase tracking-[0.2em] text-white/40">Tiến độ</div>
                        <div className="mt-2 font-medium">
                          {assignment.completed_steps}/{assignment.total_steps} bước
                        </div>
                      </div>
                      <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-white/70">
                        <div className="text-xs uppercase tracking-[0.2em] text-white/40">Hạn hoàn thành</div>
                        <div className="mt-2 font-medium">
                          {assignment.due_date || 'Không có hạn'}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-black/15 px-4 py-3 text-sm text-white/70">
                        <div className="text-xs uppercase tracking-[0.2em] text-white/40">Sản phẩm nộp</div>
                        <div className="mt-2 font-medium">
                          {assignment.submission_attachments.length} tệp
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                        <span>Hoàn thành {assignment.progress_percent}%</span>
                        {assignment.is_overdue && (
                          <span className="text-amber-300">Đã quá hạn</span>
                        )}
                      </div>
                      <div className="h-2 rounded-full bg-white/8">
                        <div
                          className="h-2 rounded-full bg-miru-primary transition-all"
                          style={{ width: getProgressWidth(assignment.progress_percent) }}
                        />
                      </div>
                    </div>

                    {assignment.checklist_items.length > 0 && (
                      <div className="mt-4 space-y-2 rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="text-sm font-medium text-white/80">Checklist</div>
                        {assignment.checklist_items.map((item) => {
                          const done = assignment.checked_item_ids.includes(item.id);
                          return (
                            <div key={item.id} className="flex items-center gap-3 text-sm text-white/70">
                              <div
                                className={`h-2.5 w-2.5 rounded-full ${
                                  done ? 'bg-green-400' : 'bg-white/20'
                                }`}
                              />
                              <span className={done ? 'text-white/90' : ''}>{vi(item.label)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {assignment.completion_notes && (
                      <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="mb-2 text-sm font-medium text-white/80">Ghi chú từ thân chủ</div>
                        <p className="text-sm text-white/65">{vi(assignment.completion_notes)}</p>
                      </div>
                    )}

                    {assignment.submission_attachments.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-4">
                        <div className="mb-3 text-sm font-medium text-white/80">Tệp thân chủ đã nộp</div>
                        <div className="space-y-2">
                          {assignment.submission_attachments.map((attachment) => (
                            <a
                              key={attachment.path}
                              href={attachment.url ?? '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/10"
                            >
                              <span>{attachment.name}</span>
                              <span className="text-xs text-white/45">
                                {attachment.mime_type ?? 'Tệp đính kèm'}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel h-fit rounded-3xl p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Giao bài tập mới</h2>
            <p className="mt-2 text-sm text-white/55">
              Thân chủ có thể nộp sản phẩm bằng Word (DOC/DOCX), PDF, MP3/M4A, MP4 hoặc ảnh PNG/JPG.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tiêu đề bài tập"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Mô tả và hướng dẫn cho thân chủ..."
              rows={4}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-white/60">Loại bài tập</label>
                <select
                  value={assignmentType}
                  onChange={(event) => setAssignmentType(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                >
                  <option value="exercise">Bài thực hành</option>
                  <option value="reading">Đọc tài liệu</option>
                  <option value="journal">Viết nhật ký</option>
                  <option value="meditation">Thực hành thư giãn</option>
                  <option value="task">Công việc</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm text-white/60">Mức ưu tiên</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/60">Hạn hoàn thành</label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-miru-primary/50 focus:outline-none"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-white">Checklist từng bước</div>
                  <div className="text-sm text-white/45">
                    Các bước này sẽ được thân chủ tick tiến độ khi thực hiện.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/15"
                >
                  <Plus size={16} />
                  Thêm bước
                </button>
              </div>

              <div className="space-y-3">
                {checklistItems.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="w-7 shrink-0 text-sm text-white/40">{index + 1}.</span>
                    <input
                      type="text"
                      value={item.label}
                      onChange={(event) => updateChecklistItem(item.id, event.target.value)}
                      placeholder="Ví dụ: Viết 3 dòng về cảm xúc hôm nay"
                      className="flex-1 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(item.id)}
                      className="rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateAssignment}
              disabled={!title.trim() || isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-medium glass-button disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <Plus size={18} />}
              Giao bài tập
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
