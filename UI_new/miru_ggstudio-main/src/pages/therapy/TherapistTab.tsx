import type { TherapistAssignment } from '../../services/contracts';
import type { AppointmentRow, MessageRow } from './types';
import { vi } from './helpers';
import { TherapistAssignmentsSection } from './TherapistAssignmentsSection';
import { TherapistAppointmentsSection } from './TherapistAppointmentsSection';
import { TherapistMessagesSection } from './TherapistMessagesSection';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  myAssessmentsQueryOptions,
  myCurrentTreatmentProgramQueryOptions,
} from '../../queries/appQueries';

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
  const assessmentsQuery = useQuery(myAssessmentsQueryOptions());
  const treatmentProgramQuery = useQuery({
    ...myCurrentTreatmentProgramQueryOptions(),
    enabled: Boolean(therapist),
  });
  const pendingAssessments =
    assessmentsQuery.data?.assignments.filter((assignment) => assignment.status !== 'completed') ?? [];
  const publishedProgram = treatmentProgramQuery.data?.program ?? null;

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

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/40">
              Assessment therapist giao
            </div>
            <h3 className="text-xl font-semibold">Các thang đo tâm lý đang chờ bạn thực hiện</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/60">
              Mở danh sách assessment để làm PHQ-9, GAD-7 hoặc DASS-21 mà therapist đã giao cho bạn.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-black/15 px-4 py-3 text-center">
              <div className="text-2xl font-bold">{pendingAssessments.length}</div>
              <div className="text-xs text-white/50">Đang chờ</div>
            </div>
            <Link
              to="/assessments"
              className="inline-flex items-center gap-2 rounded-2xl bg-miru-primary px-4 py-3 text-sm font-semibold text-white"
            >
              <ClipboardList size={16} />
              Mở assessment
            </Link>
          </div>
        </div>

        {assessmentsQuery.isLoading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-white/50">
            <LoaderCircle size={15} className="animate-spin" />
            Đang tải assessment...
          </div>
        )}

        {!assessmentsQuery.isLoading && pendingAssessments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {pendingAssessments.slice(0, 3).map((assignment) => (
              <Link
                key={assignment.id}
                to={`/assessments/${assignment.id}`}
                className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/75 transition-colors hover:bg-white/10"
              >
                {vi(String(assignment.template_short_code ?? assignment.template_name ?? 'Assessment'))}
              </Link>
            ))}
          </div>
        )}
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
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="mb-2 text-xs uppercase tracking-[0.3em] text-white/40">
              Kế hoạch trị liệu
            </div>
            <h3 className="text-xl font-semibold">Lộ trình therapist đã publish cho bạn</h3>
            <p className="mt-2 text-sm text-white/60">
              Kế hoạch này chỉ hiển thị sau khi therapist chốt và publish cho thân chủ xem.
            </p>

            {treatmentProgramQuery.isLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-white/50">
                <LoaderCircle size={15} className="animate-spin" />
                Đang tải kế hoạch trị liệu...
              </div>
            )}

            {!treatmentProgramQuery.isLoading && !publishedProgram && (
              <div className="mt-4 rounded-2xl bg-black/15 px-4 py-3 text-sm text-white/55">
                Therapist chưa publish kế hoạch trị liệu cho bạn.
              </div>
            )}

            {publishedProgram && (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-black/15 p-4">
                  <div className="text-lg font-semibold">
                    {String(publishedProgram.title ?? 'Chương trình trị liệu')}
                  </div>
                  <div className="mt-2 text-sm text-white/60">
                    {(publishedProgram.approaches ?? []).join(', ') || 'Chưa có liệu pháp cụ thể'}
                  </div>
                  {publishedProgram.summary && (
                    <p className="mt-3 text-sm leading-7 text-white/70">
                      {String(publishedProgram.summary)}
                    </p>
                  )}
                </div>

                {treatmentProgramQuery.data?.goals?.length ? (
                  <div className="rounded-2xl bg-black/15 p-4">
                    <div className="mb-3 font-medium">Mục tiêu đang theo đuổi</div>
                    <div className="space-y-2">
                      {treatmentProgramQuery.data.goals.map((goal) => (
                        <div key={goal.id} className="rounded-2xl border border-white/10 px-3 py-3 text-sm text-white/75">
                          <div className="font-medium text-white">{goal.title}</div>
                          {goal.description && <div className="mt-1 text-white/60">{goal.description}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {treatmentProgramQuery.data?.sessions?.length ? (
                  <div className="rounded-2xl bg-black/15 p-4">
                    <div className="mb-3 font-medium">Các phiên đã lên kế hoạch</div>
                    <div className="space-y-2">
                      {treatmentProgramQuery.data.sessions.map((session) => (
                        <div key={session.id} className="rounded-2xl border border-white/10 px-3 py-3 text-sm text-white/75">
                          <div className="font-medium text-white">
                            Phiên {session.session_number}: {session.title || 'Chưa đặt tiêu đề'}
                          </div>
                          {session.objectives && <div className="mt-1 text-white/60">{session.objectives}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
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
