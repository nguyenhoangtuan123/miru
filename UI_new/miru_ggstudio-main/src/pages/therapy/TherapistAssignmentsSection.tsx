import { ClipboardList, Paperclip } from 'lucide-react';
import type { TherapistAssignment } from '../../services/contracts';
import { formatAssignmentStatus, formatAssignmentType, formatPriority, getProgressWidth, vi } from './helpers';

type TherapistAssignmentsSectionProps = {
  assignments: TherapistAssignment[];
  assignmentBusyMap: Record<number, boolean>;
  noteDrafts: Record<number, string>;
  setNoteDraft: (assignmentId: number, value: string) => void;
  onToggleChecklist: (assignment: TherapistAssignment, itemId: string) => Promise<void>;
  onSaveNotes: (assignment: TherapistAssignment) => Promise<void>;
  onUploadFiles: (assignment: TherapistAssignment, files: FileList | null) => Promise<void>;
  onCompleteAssignment: (assignment: TherapistAssignment) => Promise<void>;
};

export function TherapistAssignmentsSection({
  assignments,
  assignmentBusyMap,
  noteDrafts,
  setNoteDraft,
  onToggleChecklist,
  onSaveNotes,
  onUploadFiles,
  onCompleteAssignment,
}: TherapistAssignmentsSectionProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <ClipboardList size={18} />
        Bài tập từ nhà trị liệu
      </h3>

      <div className="space-y-4">
        {assignments.length === 0 ? (
          <div className="text-sm text-white/50">Chưa có bài tập nào từ nhà trị liệu.</div>
        ) : (
          assignments.map((assignment) => {
            const assignmentId =
              typeof assignment.id !== 'undefined' ? Number(assignment.id) : null;
            const busy =
              assignmentId !== null ? Boolean(assignmentBusyMap[assignmentId]) : false;
            const allChecklistDone =
              assignment.total_steps === 0 ||
              assignment.completed_steps >= assignment.total_steps;

            return (
              <div
                key={String(assignment.id ?? assignment.title)}
                className="rounded-2xl border border-white/10 bg-black/15 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <div className="font-medium">
                        {vi(String(assignment.title ?? 'Bài tập'))}
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70">
                        {formatAssignmentType(assignment.type)}
                      </span>
                      <span className="rounded-full bg-miru-primary/15 px-3 py-1 text-[11px] text-miru-primary">
                        Ưu tiên {formatPriority(assignment.priority)}
                      </span>
                    </div>
                    {assignment.description && (
                      <p className="mt-2 text-sm text-white/60">{vi(assignment.description)}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/75">
                    {formatAssignmentStatus(assignment.status)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/40">Tiến độ</div>
                    <div className="mt-2 font-medium">
                      {assignment.completed_steps}/{assignment.total_steps} bước
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                      Hạn hoàn thành
                    </div>
                    <div className="mt-2 font-medium">{assignment.due_date || 'Không có hạn'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                      Sản phẩm đã nộp
                    </div>
                    <div className="mt-2 font-medium">
                      {assignment.submission_attachments.length} tệp
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-white/50">
                    <span>{assignment.progress_percent}% hoàn thành</span>
                    {assignment.is_overdue && <span className="text-amber-300">Đã quá hạn</span>}
                  </div>
                  <div className="h-2 rounded-full bg-white/8">
                    <div
                      className="h-2 rounded-full bg-miru-primary transition-all"
                      style={{ width: getProgressWidth(assignment.progress_percent) }}
                    />
                  </div>
                </div>

                {assignment.checklist_items.length > 0 && (
                  <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-medium text-white/85">
                      Checklist cần hoàn thành
                    </div>
                    {assignment.checklist_items.map((item) => {
                      const checked = assignment.checked_item_ids.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-center gap-3 text-sm text-white/70"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy || assignment.status === 'completed'}
                            onChange={() => void onToggleChecklist(assignment, item.id)}
                            className="h-4 w-4 rounded border-white/20 bg-transparent text-miru-primary focus:ring-miru-primary"
                          />
                          <span className={checked ? 'text-white/90' : ''}>{vi(item.label)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 text-sm font-medium text-white/85">Ghi chú khi nộp bài</div>
                  <textarea
                    value={assignmentId !== null ? noteDrafts[assignmentId] ?? '' : ''}
                    onChange={(event) => {
                      if (assignmentId === null) {
                        return;
                      }
                      setNoteDraft(assignmentId, event.target.value);
                    }}
                    placeholder="Ví dụ: Em đã thực hiện bài tập này vào tối qua và thấy bình tĩnh hơn..."
                    rows={3}
                    disabled={busy}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
                  />

                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void onSaveNotes(assignment)}
                      disabled={assignmentId === null || busy}
                      className="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15 disabled:opacity-50"
                    >
                      {busy ? 'Đang lưu...' : 'Lưu tiến độ'}
                    </button>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15">
                      <Paperclip size={14} />
                      Nộp tệp
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.mp3,.m4a,.mp4,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={async (event) => {
                          await onUploadFiles(assignment, event.target.files);
                          event.target.value = '';
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void onCompleteAssignment(assignment)}
                      disabled={assignmentId === null || busy || !allChecklistDone}
                      className="rounded-xl bg-green-500/15 px-3 py-2 text-xs font-medium text-green-300 transition-colors hover:bg-green-500/25 disabled:opacity-50"
                    >
                      {busy ? 'Đang cập nhật...' : 'Đánh dấu hoàn thành'}
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-white/45">
                    Hỗ trợ nộp Word (DOC/DOCX), PDF, MP3/M4A, MP4 và ảnh PNG/JPG.
                  </div>
                </div>

                {assignment.submission_attachments.length > 0 && (
                  <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-medium text-white/85">Tệp đã nộp</div>
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
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
