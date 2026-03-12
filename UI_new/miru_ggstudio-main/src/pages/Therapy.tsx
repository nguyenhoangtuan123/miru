import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookHeart,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  completeTherapistAssignment,
  confirmClientAppointment,
  createGoal,
  getCheckinStatus,
  getClientAppointments,
  getClientAssignments,
  getClientTherapist,
  getClientTherapistMessages,
  getGoals,
  getJournalEntries,
  getProactiveMessage,
  markClientTherapistMessagesRead,
  sendClientTherapistMessage,
  updateGoal,
} from '../services/backend';
import { repairMojibake } from '../lib/text';
import type { Goal, JournalEntry } from '../services/contracts';

type PairingRecord = Record<string, unknown> | null;
type AssignmentRow = Record<string, unknown>;
type AppointmentRow = Record<string, unknown>;
type MessageRow = Record<string, unknown>;

function getTherapistInfo(pairing: PairingRecord) {
  if (!pairing || typeof pairing !== 'object') {
    return null;
  }
  const therapist = pairing.therapist;
  if (therapist && typeof therapist === 'object') {
    return therapist as Record<string, unknown>;
  }
  return null;
}

function vi(text: string) {
  return repairMojibake(text);
}

export function Therapy() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'exercises' | 'reports' | 'therapist'>('exercises');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [proactiveMessage, setProactiveMessage] = useState(
    'Miru sẽ hiển thị báo cáo sau khi dữ liệu mood được đồng bộ.'
  );
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pairing, setPairing] = useState<PairingRecord>(null);
  const [therapistAssignments, setTherapistAssignments] = useState<AssignmentRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [completingAssignmentId, setCompletingAssignmentId] = useState<number | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [goalsResult, journalsResult, statusResult, proactiveResult] =
          await Promise.allSettled([
            getGoals(user.id),
            getJournalEntries(user.id, 3),
            getCheckinStatus(user.id),
            getProactiveMessage(user.id),
          ]);

        if (cancelled) {
          return;
        }

        if (goalsResult.status === 'fulfilled') {
          setGoals(goalsResult.value.goals);
        }
        if (journalsResult.status === 'fulfilled') {
          setJournals(journalsResult.value.entries);
        }
        if (statusResult.status === 'fulfilled') {
          setStreak(statusResult.value.streak ?? 0);
          setLastScore(statusResult.value.last_score ?? null);
        }
        if (proactiveResult.status === 'fulfilled' && proactiveResult.value.message) {
          setProactiveMessage(proactiveResult.value.message);
        }

        const firstFailure =
          goalsResult.status === 'rejected'
            ? goalsResult.reason
            : journalsResult.status === 'rejected'
              ? journalsResult.reason
              : statusResult.status === 'rejected'
                ? statusResult.reason
                : proactiveResult.status === 'rejected'
                  ? proactiveResult.reason
                  : null;

        if (firstFailure instanceof Error) {
          setError(firstFailure.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadSupportData = async () => {
      try {
        setSupportError(null);
        const pairingResponse = await getClientTherapist(user.id);
        if (cancelled) {
          return;
        }

        const nextPairing = (pairingResponse.pairing as PairingRecord) ?? null;
        setPairing(nextPairing);

        if (!nextPairing) {
          setTherapistAssignments([]);
          setAppointments([]);
          setMessages([]);
          return;
        }

        const [assignmentsResult, appointmentsResult, messagesResult] =
          await Promise.allSettled([
            getClientAssignments(user.id),
            getClientAppointments(user.id),
            getClientTherapistMessages(user.id),
          ]);

        if (cancelled) {
          return;
        }

        if (assignmentsResult.status === 'fulfilled') {
          setTherapistAssignments(assignmentsResult.value.assignments);
        }
        if (appointmentsResult.status === 'fulfilled') {
          setAppointments(appointmentsResult.value.appointments);
        }
        if (messagesResult.status === 'fulfilled') {
          setMessages(messagesResult.value.messages);
          void markClientTherapistMessagesRead(user.id);
        }

        const firstFailure =
          assignmentsResult.status === 'rejected'
            ? assignmentsResult.reason
            : appointmentsResult.status === 'rejected'
              ? appointmentsResult.reason
              : messagesResult.status === 'rejected'
                ? messagesResult.reason
                : null;

        if (firstFailure instanceof Error) {
          setSupportError(firstFailure.message);
        }
      } catch (supportLoadError) {
        if (!cancelled) {
          setPairing(null);
          setTherapistAssignments([]);
          setAppointments([]);
          setMessages([]);
          setSupportError(
            supportLoadError instanceof Error ? supportLoadError.message : 'Không tải được dữ liệu therapist'
          );
        }
      }
    };

    void loadSupportData();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const therapist = useMemo(() => getTherapistInfo(pairing), [pairing]);

  async function toggleGoal(goal: Goal) {
    if (!goal.id) {
      return;
    }
    try {
      setError(null);
      const nextCompleted = !goal.completed;
      setGoals((prev) =>
        prev.map((item) => (item.id === goal.id ? { ...item, completed: nextCompleted } : item))
      );
      const response = await updateGoal(goal.id, { completed: nextCompleted });
      if (!response.success) {
        throw new Error('Không cập nhật được mục tiêu');
      }
    } catch (toggleError) {
      setGoals((prev) =>
        prev.map((item) => (item.id === goal.id ? { ...item, completed: goal.completed } : item))
      );
      setError(toggleError instanceof Error ? toggleError.message : 'Không cập nhật được mục tiêu');
    }
  }

  async function handleCreateGoal() {
    if (!user?.id || !newGoalTitle.trim()) {
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const response = await createGoal({ user_id: user.id, title: newGoalTitle.trim() });
      if (!response.success || !response.goal) {
        throw new Error('Không tạo được mục tiêu');
      }
      setGoals((prev) => [response.goal, ...prev]);
      setNewGoalTitle('');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không tạo được mục tiêu');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendTherapistMessage() {
    if (!user?.id || !messageDraft.trim()) {
      return;
    }

    try {
      setIsSendingMessage(true);
      const optimisticMessage = {
        id: `draft-${Date.now()}`,
        sender_type: 'client',
        message_content: messageDraft.trim(),
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMessage]);
      const content = messageDraft.trim();
      setMessageDraft('');

      const response = await sendClientTherapistMessage(user.id, content);
      if (response.message) {
        setMessages((prev) => [
          ...prev.filter((item) => item.id !== optimisticMessage.id),
          response.message,
        ]);
      }
    } catch (messageError) {
      setSupportError(
        messageError instanceof Error ? messageError.message : 'Không gửi được tin nhắn'
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleConfirmAppointment(appointmentId: number) {
    if (!user?.id) {
      return;
    }
    try {
      await confirmClientAppointment(user.id, appointmentId);
      setAppointments((prev) =>
        prev.map((appointment) =>
          appointment.id === appointmentId
            ? { ...appointment, client_confirmed: true }
            : appointment
        )
      );
    } catch (appointmentError) {
      setSupportError(
        appointmentError instanceof Error
          ? appointmentError.message
          : 'Không xác nhận được lịch hẹn'
      );
    }
  }

  async function handleCompleteAssignment(assignmentId: number) {
    try {
      setCompletingAssignmentId(assignmentId);
      const response = await completeTherapistAssignment(assignmentId);
      if (response.assignment) {
        setTherapistAssignments((prev) =>
          prev.map((assignment) =>
            Number(assignment.id) === assignmentId
              ? { ...assignment, ...response.assignment }
              : assignment
          )
        );
      }
    } catch (assignmentError) {
      setSupportError(
        assignmentError instanceof Error
          ? assignmentError.message
          : 'Không cập nhật được bài tập'
      );
    } finally {
      setCompletingAssignmentId(null);
    }
  }

  return (
    <div className="min-h-screen bg-miru-bg p-4 md:p-8 pb-32">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Trị liệu & Mục tiêu</h1>
            <p className="text-white/60">
              Goals, check-in, bài tập của therapist và trao đổi hỗ trợ đều tập trung ở đây.
            </p>
          </div>
          {isLoading && (
            <div className="text-sm text-white/40 flex items-center gap-2">
              <LoaderCircle size={16} className="animate-spin" />
              Đang tải
            </div>
          )}
        </header>

        {(error || supportError) && (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {supportError ?? error}
          </div>
        )}

        <div className="flex gap-2 mb-8 bg-white/5 p-1 rounded-2xl w-fit flex-wrap">
          {[
            { id: 'exercises', label: 'Bài tập', icon: ClipboardList },
            { id: 'reports', label: 'Báo cáo AI', icon: FileText },
            { id: 'therapist', label: 'Therapist', icon: Stethoscope },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'exercises' | 'reports' | 'therapist')}
                className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-miru-primary text-[#ffffff] shadow-lg'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'exercises' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="glass-panel p-6 rounded-3xl">
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  value={newGoalTitle}
                  onChange={(event) => setNewGoalTitle(event.target.value)}
                  placeholder="Thêm mục tiêu hoặc bài tập mới..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50 transition-colors"
                />
                <button
                  onClick={handleCreateGoal}
                  disabled={!newGoalTitle.trim() || isSubmitting}
                  className="glass-button px-5 py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <Plus size={18} />}
                  Thêm nhanh
                </button>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-3xl mb-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <BookHeart size={28} className="text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Kế hoạch của bạn</h3>
                <p className="text-sm text-white/60">
                  Hoàn thành từng mục tiêu nhỏ để giữ nhịp chăm sóc tinh thần.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {goals.length === 0 ? (
                <div className="glass-panel p-6 rounded-2xl text-white/50 text-sm">
                  Chưa có mục tiêu nào. Tạo mục tiêu đầu tiên ở ô phía trên.
                </div>
              ) : (
                goals.map((goal) => (
                  <div
                    key={goal.id ?? goal.title}
                    onClick={() => toggleGoal(goal)}
                    className={`glass-panel p-5 rounded-2xl transition-all border cursor-pointer group ${
                      goal.completed
                        ? 'border-green-500/30 bg-green-500/10 opacity-80'
                        : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 shrink-0 ${goal.completed ? 'text-green-400' : 'text-white/40'}`}>
                        {goal.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1 gap-4">
                          <h3 className={`font-medium text-lg ${goal.completed ? 'line-through text-white/50' : 'text-white/90'}`}>
                            {goal.title}
                          </h3>
                          <span className={`text-xs px-2 py-1 rounded-md whitespace-nowrap ${goal.completed ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/70'}`}>
                            {goal.completed ? 'Đã hoàn thành' : 'Đang thực hiện'}
                          </span>
                        </div>
                        {goal.description && <p className="text-sm text-white/60">{vi(goal.description)}</p>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="glass-panel p-6 md:p-8 rounded-3xl">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium mb-4">
                    <Sparkles size={14} />
                    AI Summary
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Tổng hợp chăm sóc gần đây</h2>
                  <p className="text-white/70 mb-6 leading-relaxed">{vi(proactiveMessage)}</p>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <h4 className="font-medium mb-2 text-blue-300">Mood check-in</h4>
                      <p className="text-sm text-white/70">
                        Streak hiện tại: <strong>{streak}</strong> ngày. Điểm gần nhất: <strong>{lastScore ?? '--'}/10</strong>.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <h4 className="font-medium mb-2 text-orange-300">Nhật ký gần đây</h4>
                      <p className="text-sm text-white/70">
                        Đã lưu {journals.length} entry gần nhất để tạo thêm insight.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-1/3 glass-panel p-6 rounded-2xl bg-gradient-to-br from-white/5 to-transparent">
                  <h3 className="font-medium mb-4 flex items-center gap-2">
                    <BookHeart size={20} className="text-miru-primary" />
                    Snapshot
                  </h3>
                  <div className="space-y-3 text-sm text-white/70">
                    <div className="flex items-center justify-between">
                      <span>Mục tiêu đang mở</span>
                      <strong>{goals.filter((goal) => !goal.completed).length}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Mục tiêu hoàn thành</span>
                      <strong>{goals.filter((goal) => goal.completed).length}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Nhật ký gần nhất</span>
                      <strong>{journals.length}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'therapist' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {!therapist ? (
              <div className="glass-panel p-6 rounded-3xl text-white/60">
                Chưa kết nối với nhà trị liệu. Vào trang Cài đặt để nhập pairing code.
              </div>
            ) : (
              <>
                <div className="glass-panel p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">Connected therapist</div>
                    <h2 className="text-2xl font-bold">{vi(String(therapist.name ?? 'Nhà trị liệu'))}</h2>
                    <p className="text-white/60">{String(therapist.email ?? '')}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl bg-white/5 px-4 py-3">
                      <div className="text-2xl font-bold">{therapistAssignments.length}</div>
                      <div className="text-xs text-white/50">Assignments</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 px-4 py-3">
                      <div className="text-2xl font-bold">{appointments.length}</div>
                      <div className="text-xs text-white/50">Appointments</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 px-4 py-3">
                      <div className="text-2xl font-bold">{messages.length}</div>
                      <div className="text-xs text-white/50">Messages</div>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="glass-panel p-6 rounded-3xl">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <ClipboardList size={18} />
                      Bài tập từ therapist
                    </h3>
                    <div className="space-y-3">
                      {therapistAssignments.length === 0 ? (
                        <div className="text-sm text-white/50">Chưa có bài tập nào từ therapist.</div>
                      ) : (
                        therapistAssignments.map((assignment) => (
                          <div key={String(assignment.id ?? assignment.title)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="font-medium">{vi(String(assignment.title ?? 'Bài tập'))}</div>
                            {typeof assignment.description === 'string' && (
                              <p className="text-sm text-white/60 mt-2">{vi(assignment.description)}</p>
                            )}
                            <div className="flex items-center justify-between gap-3 mt-3 text-xs text-white/50">
                              <span>{typeof assignment.status === 'string' ? vi(assignment.status) : 'pending'}</span>
                              <span>{typeof assignment.due_date === 'string' ? assignment.due_date : 'Không có hạn'}</span>
                            </div>
                            {assignment.status !== 'completed' && typeof assignment.id !== 'undefined' && (
                              <button
                                onClick={() => handleCompleteAssignment(Number(assignment.id))}
                                disabled={completingAssignmentId === Number(assignment.id)}
                                className="mt-4 rounded-xl bg-green-500/15 px-3 py-2 text-xs font-medium text-green-300 transition-colors hover:bg-green-500/25 disabled:opacity-50"
                              >
                                {completingAssignmentId === Number(assignment.id)
                                  ? 'Đang cập nhật...'
                                  : 'Đánh dấu hoàn thành'}
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="glass-panel p-6 rounded-3xl">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <CalendarClock size={18} />
                      Lịch hẹn
                    </h3>
                    <div className="space-y-3">
                      {appointments.length === 0 ? (
                        <div className="text-sm text-white/50">Chưa có lịch hẹn nào.</div>
                      ) : (
                        appointments.map((appointment) => (
                          <div key={String(appointment.id)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="font-medium">
                                  {typeof appointment.appointment_date === 'string'
                                    ? new Date(appointment.appointment_date).toLocaleString('vi-VN')
                                    : 'Lịch hẹn'}
                                </div>
                                <div className="text-sm text-white/60 mt-1">
                                  {typeof appointment.notes === 'string' && appointment.notes
                                    ? vi(appointment.notes)
                                    : typeof appointment.type === 'string'
                                      ? vi(appointment.type)
                                      : 'Buổi hẹn'}
                                </div>
                              </div>
                              {appointment.client_confirmed ? (
                                <span className="px-3 py-1 rounded-full text-xs bg-green-500/20 text-green-300">
                                  Đã xác nhận
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleConfirmAppointment(Number(appointment.id))}
                                  className="px-3 py-1 rounded-full text-xs bg-miru-primary/20 text-miru-primary hover:bg-miru-primary/30 transition-colors"
                                >
                                  Xác nhận
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-6 rounded-3xl">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <MessageCircle size={18} />
                    Nhắn tin với therapist
                  </h3>
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 mb-4">
                    {messages.length === 0 ? (
                      <div className="text-sm text-white/50">Chưa có tin nhắn nào.</div>
                    ) : (
                      messages.map((message) => {
                        const isMine = message.sender_type === 'client';
                        return (
                          <div
                            key={String(message.id ?? `${message.sender_type}-${message.created_at}`)}
                            className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                              isMine ? 'bg-miru-primary text-white' : 'bg-white/8 text-white/85'
                            }`}>
                              <div>{vi(String(message.message_content ?? ''))}</div>
                              <div className={`text-[11px] mt-2 ${isMine ? 'text-white/70' : 'text-white/40'}`}>
                                {typeof message.created_at === 'string'
                                  ? new Date(message.created_at).toLocaleString('vi-VN')
                                  : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      placeholder="Gửi tin nhắn cho therapist..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-miru-primary/50 transition-colors"
                    />
                    <button
                      onClick={handleSendTherapistMessage}
                      disabled={!messageDraft.trim() || isSendingMessage}
                      className="glass-button px-5 py-3 rounded-2xl font-medium disabled:opacity-60 flex items-center gap-2"
                    >
                      {isSendingMessage ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
                      Gửi
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
