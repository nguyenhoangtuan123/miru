import type { TherapistAssignment } from '../../services/contracts';
import type { AppointmentRow, MessageRow } from './types';
import { vi } from './helpers';
import { TherapistAssignmentsSection } from './TherapistAssignmentsSection';
import { TherapistAppointmentsSection } from './TherapistAppointmentsSection';
import { TherapistMessagesSection } from './TherapistMessagesSection';

type TherapistTabProps = {
  therapist: Record<string, unknown> | null;
  assignments: TherapistAssignment[];
  appointments: AppointmentRow[];
  messages: MessageRow[];
  assignmentBusyMap: Record<number, boolean>;
  noteDrafts: Record<number, string>;
  setNoteDraft: (assignmentId: number, value: string) => void;
  messageDraft: string;
  setMessageDraft: (value: string) => void;
  isSendingMessage: boolean;
  onToggleChecklist: (assignment: TherapistAssignment, itemId: string) => Promise<void>;
  onSaveNotes: (assignment: TherapistAssignment) => Promise<void>;
  onUploadFiles: (assignment: TherapistAssignment, files: FileList | null) => Promise<void>;
  onCompleteAssignment: (assignment: TherapistAssignment) => Promise<void>;
  onConfirmAppointment: (appointmentId: number) => Promise<void>;
  onSendMessage: () => Promise<void>;
};

export function TherapistTab({
  therapist,
  assignments,
  appointments,
  messages,
  assignmentBusyMap,
  noteDrafts,
  setNoteDraft,
  messageDraft,
  setMessageDraft,
  isSendingMessage,
  onToggleChecklist,
  onSaveNotes,
  onUploadFiles,
  onCompleteAssignment,
  onConfirmAppointment,
  onSendMessage,
}: TherapistTabProps) {
  if (!therapist) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
        Chưa kết nối với nhà trị liệu. Vào phần Cài đặt để nhập mã kết nối.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 md:flex-row md:items-center">
        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/40">
            Nhà trị liệu đang kết nối
          </div>
          <h2 className="text-2xl font-bold">
            {vi(String(therapist.name ?? 'Nhà trị liệu'))}
          </h2>
          <p className="text-white/60">{String(therapist.email ?? '')}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-black/15 px-4 py-3">
            <div className="text-2xl font-bold">{assignments.length}</div>
            <div className="text-xs text-white/50">Bài tập</div>
          </div>
          <div className="rounded-2xl bg-black/15 px-4 py-3">
            <div className="text-2xl font-bold">{appointments.length}</div>
            <div className="text-xs text-white/50">Lịch hẹn</div>
          </div>
          <div className="rounded-2xl bg-black/15 px-4 py-3">
            <div className="text-2xl font-bold">{messages.length}</div>
            <div className="text-xs text-white/50">Tin nhắn</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TherapistAssignmentsSection
          assignments={assignments}
          assignmentBusyMap={assignmentBusyMap}
          noteDrafts={noteDrafts}
          setNoteDraft={setNoteDraft}
          onToggleChecklist={onToggleChecklist}
          onSaveNotes={onSaveNotes}
          onUploadFiles={onUploadFiles}
          onCompleteAssignment={onCompleteAssignment}
        />

        <div className="space-y-6">
          <TherapistAppointmentsSection
            appointments={appointments}
            onConfirmAppointment={onConfirmAppointment}
          />
          <TherapistMessagesSection
            messages={messages}
            messageDraft={messageDraft}
            setMessageDraft={setMessageDraft}
            isSendingMessage={isSendingMessage}
            onSendMessage={onSendMessage}
          />
        </div>
      </div>
    </div>
  );
}
