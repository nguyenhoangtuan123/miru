import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  completeTherapistAssignment,
  confirmClientAppointment,
  createGoal,
  markClientTherapistMessagesRead,
  sendClientTherapistMessage,
  updateGoal,
  updateTherapistAssignmentProgress,
  uploadAssignmentAttachments,
} from '../../services/backend';
import type { Goal, JournalEntry, TherapistAssignment } from '../../services/contracts';
import {
  checkinStatusQueryOptions,
  clientAppointmentsQueryOptions,
  clientAssignmentsQueryOptions,
  clientTherapistMessagesQueryOptions,
  clientTherapistQueryOptions,
  goalsQueryOptions,
  journalEntriesQueryOptions,
  proactiveMessageQueryOptions,
  queryKeys,
} from '../../queries/appQueries';
import {
  type ClientAppointmentsQueryData,
  type ClientAssignmentsQueryData,
  type ClientMessagesQueryData,
  type GoalsQueryData,
  type JournalQueryData,
  type PairingRecord,
  type PairingQueryData,
} from './types';
import { getTherapistInfo } from './helpers';

export function useTherapyViewModel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';

  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [assignmentBusyMap, setAssignmentBusyMap] = useState<Record<number, boolean>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

  const goalsOptions = useMemo(() => goalsQueryOptions(userId), [userId]);
  const journalsOptions = useMemo(() => journalEntriesQueryOptions(userId, 3), [userId]);
  const checkinOptions = useMemo(() => checkinStatusQueryOptions(userId), [userId]);
  const proactiveOptions = useMemo(() => proactiveMessageQueryOptions(userId), [userId]);
  const pairingOptions = useMemo(() => clientTherapistQueryOptions(userId), [userId]);
  const assignmentsOptions = useMemo(() => clientAssignmentsQueryOptions(userId), [userId]);
  const appointmentsOptions = useMemo(() => clientAppointmentsQueryOptions(userId), [userId]);
  const messagesOptions = useMemo(() => clientTherapistMessagesQueryOptions(userId), [userId]);

  const goalsQuery = useQuery<GoalsQueryData>({ ...goalsOptions, enabled: Boolean(userId) });
  const journalsQuery = useQuery<JournalQueryData>({ ...journalsOptions, enabled: Boolean(userId) });
  const checkinQuery = useQuery<{
    success: boolean;
    streak?: number;
    last_score?: number | null;
  }>({ ...checkinOptions, enabled: Boolean(userId) });
  const proactiveQuery = useQuery<{
    success: boolean;
    message?: string;
  }>({ ...proactiveOptions, enabled: Boolean(userId) });
  const pairingQuery = useQuery<PairingQueryData>({ ...pairingOptions, enabled: Boolean(userId) });

  const pairing = (pairingQuery.data?.pairing as PairingRecord) ?? null;
  const therapist = useMemo(() => getTherapistInfo(pairing), [pairing]);
  const hasTherapist = Boolean(pairing);

  const assignmentsQuery = useQuery<ClientAssignmentsQueryData>({
    ...assignmentsOptions,
    enabled: Boolean(userId) && hasTherapist,
  });
  const appointmentsQuery = useQuery<ClientAppointmentsQueryData>({
    ...appointmentsOptions,
    enabled: Boolean(userId) && hasTherapist,
  });
  const messagesQuery = useQuery<ClientMessagesQueryData>({
    ...messagesOptions,
    enabled: Boolean(userId) && hasTherapist,
  });

  const goals = goalsQuery.data?.goals ?? [];
  const journals = journalsQuery.data?.entries ?? [];
  const streak = checkinQuery.data?.streak ?? 0;
  const lastScore = checkinQuery.data?.last_score ?? null;
  const proactiveMessage =
    proactiveQuery.data?.message ?? 'Miru sẽ hiển thị báo cáo sau khi dữ liệu mood được đồng bộ.';
  const therapistAssignments = assignmentsQuery.data?.assignments ?? [];
  const appointments = appointmentsQuery.data?.appointments ?? [];
  const messages = messagesQuery.data?.messages ?? [];

  const isLoading =
    goalsQuery.isPending ||
    journalsQuery.isPending ||
    checkinQuery.isPending ||
    proactiveQuery.isPending ||
    pairingQuery.isPending ||
    (hasTherapist &&
      (assignmentsQuery.isPending || appointmentsQuery.isPending || messagesQuery.isPending));

  const dataError =
    goalsQuery.error ??
    journalsQuery.error ??
    checkinQuery.error ??
    proactiveQuery.error ??
    pairingQuery.error ??
    assignmentsQuery.error ??
    appointmentsQuery.error ??
    messagesQuery.error;

  const resolvedError =
    supportError ?? goalError ?? (dataError instanceof Error ? dataError.message : null);

  useEffect(() => {
    setNoteDrafts((previousDrafts) => {
      const nextDrafts = { ...previousDrafts };
      const validIds = new Set<number>();
      let changed = false;

      for (const assignment of therapistAssignments) {
        if (typeof assignment.id === 'undefined') {
          continue;
        }

        const assignmentId = Number(assignment.id);
        validIds.add(assignmentId);

        if (!(assignmentId in nextDrafts)) {
          nextDrafts[assignmentId] = assignment.completion_notes ?? '';
          changed = true;
        }
      }

      for (const key of Object.keys(nextDrafts)) {
        const assignmentId = Number(key);
        if (!validIds.has(assignmentId)) {
          delete nextDrafts[assignmentId];
          changed = true;
        }
      }

      return changed ? nextDrafts : previousDrafts;
    });
  }, [therapistAssignments]);

  useEffect(() => {
    if (!userId || !hasTherapist || !messages.length) {
      return;
    }

    const hasTherapistMessage = messages.some(
      (message) => message.sender_type === 'therapist'
    );

    if (!hasTherapistMessage) {
      return;
    }

    void markClientTherapistMessagesRead(userId);
  }, [hasTherapist, messages, messagesQuery.dataUpdatedAt, userId]);

  function setAssignmentBusy(assignmentId: number, nextValue: boolean) {
    setAssignmentBusyMap((previousMap) => ({
      ...previousMap,
      [assignmentId]: nextValue,
    }));
  }

  function setNoteDraft(assignmentId: number, value: string) {
    setNoteDrafts((previousDrafts) => ({
      ...previousDrafts,
      [assignmentId]: value,
    }));
  }

  function updateAssignmentState(updatedAssignment: TherapistAssignment) {
    if (typeof updatedAssignment.id === 'undefined') {
      return;
    }

    const assignmentId = Number(updatedAssignment.id);

    queryClient.setQueryData<ClientAssignmentsQueryData>(assignmentsOptions.queryKey, (previous) => {
      if (!previous) {
        return { success: true, assignments: [updatedAssignment] };
      }

      const hasExisting = previous.assignments.some(
        (assignment) => Number(assignment.id) === assignmentId
      );

      return {
        ...previous,
        assignments: hasExisting
          ? previous.assignments.map((assignment) =>
              Number(assignment.id) === assignmentId ? updatedAssignment : assignment
            )
          : [updatedAssignment, ...previous.assignments],
      };
    });

    setNoteDrafts((previousDrafts) => ({
      ...previousDrafts,
      [assignmentId]: updatedAssignment.completion_notes ?? previousDrafts[assignmentId] ?? '',
    }));
  }

  async function handleToggleGoal(goal: Goal) {
    if (!goal.id || !userId) {
      return;
    }

    const previousGoals = queryClient.getQueryData<GoalsQueryData>(goalsOptions.queryKey);
    const nextCompleted = !goal.completed;

    try {
      setGoalError(null);
      queryClient.setQueryData<GoalsQueryData>(goalsOptions.queryKey, (previous) => ({
        success: previous?.success ?? true,
        goals:
          previous?.goals.map((item) =>
            item.id === goal.id ? { ...item, completed: nextCompleted } : item
          ) ?? [],
      }));

      const response = await updateGoal(goal.id, { completed: nextCompleted });
      if (!response.success) {
        throw new Error('Không cập nhật được mục tiêu');
      }
    } catch (toggleError) {
      queryClient.setQueryData(goalsOptions.queryKey, previousGoals);
      setGoalError(
        toggleError instanceof Error ? toggleError.message : 'Không cập nhật được mục tiêu'
      );
    } finally {
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.all(userId) });
    }
  }

  async function handleCreateGoal() {
    if (!userId || !newGoalTitle.trim()) {
      return;
    }

    try {
      setGoalError(null);
      setIsSubmittingGoal(true);

      const response = await createGoal({
        user_id: userId,
        title: newGoalTitle.trim(),
      });

      if (!response.success || !response.goal) {
        throw new Error('Không tạo được mục tiêu');
      }

      queryClient.setQueryData<GoalsQueryData>(goalsOptions.queryKey, (previous) => ({
        success: previous?.success ?? true,
        goals: [response.goal, ...(previous?.goals ?? [])],
      }));

      setNewGoalTitle('');
    } catch (createError) {
      setGoalError(
        createError instanceof Error ? createError.message : 'Không tạo được mục tiêu'
      );
    } finally {
      setIsSubmittingGoal(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.goals.all(userId) });
    }
  }

  async function handleSendTherapistMessage() {
    if (!userId || !messageDraft.trim()) {
      return;
    }

    const content = messageDraft.trim();
    const optimisticMessage = {
      id: `draft-${Date.now()}`,
      sender_type: 'client',
      message_content: content,
      created_at: new Date().toISOString(),
    };

    try {
      setSupportError(null);
      setIsSendingMessage(true);
      setMessageDraft('');

      queryClient.setQueryData<ClientMessagesQueryData>(messagesOptions.queryKey, (previous) => ({
        success: previous?.success ?? true,
        messages: [...(previous?.messages ?? []), optimisticMessage],
      }));

      const response = await sendClientTherapistMessage(userId, content);
      if (response.message) {
        queryClient.setQueryData<ClientMessagesQueryData>(messagesOptions.queryKey, (previous) => ({
          success: previous?.success ?? true,
          messages: [
            ...(previous?.messages ?? []).filter((item) => item.id !== optimisticMessage.id),
            response.message,
          ],
        }));
      }
    } catch (messageError) {
      setSupportError(
        messageError instanceof Error ? messageError.message : 'Không gửi được tin nhắn'
      );
      setMessageDraft(content);
      void queryClient.invalidateQueries({ queryKey: messagesOptions.queryKey });
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleConfirmAppointment(appointmentId: number) {
    if (!userId) {
      return;
    }

    try {
      setSupportError(null);
      await confirmClientAppointment(userId, appointmentId);

      queryClient.setQueryData<ClientAppointmentsQueryData>(
        appointmentsOptions.queryKey,
        (previous) => ({
          success: previous?.success ?? true,
          appointments: (previous?.appointments ?? []).map((appointment) =>
            appointment.id === appointmentId
              ? { ...appointment, client_confirmed: true }
              : appointment
          ),
        })
      );
    } catch (appointmentError) {
      setSupportError(
        appointmentError instanceof Error ? appointmentError.message : 'Không xác nhận được lịch hẹn'
      );
    }
  }

  async function handleToggleChecklist(assignment: TherapistAssignment, itemId: string) {
    if (typeof assignment.id === 'undefined') {
      return;
    }

    const assignmentId = Number(assignment.id);
    const currentIds = assignment.checked_item_ids ?? [];
    const nextIds = currentIds.includes(itemId)
      ? currentIds.filter((currentId) => currentId !== itemId)
      : [...currentIds, itemId];

    try {
      setSupportError(null);
      setAssignmentBusy(assignmentId, true);
      const response = await updateTherapistAssignmentProgress(assignmentId, {
        checked_item_ids: nextIds,
        completion_notes: noteDrafts[assignmentId] ?? assignment.completion_notes ?? '',
      });

      if (response.assignment) {
        updateAssignmentState(response.assignment);
      }
    } catch (assignmentError) {
      setSupportError(
        assignmentError instanceof Error
          ? assignmentError.message
          : 'Không cập nhật được tiến độ bài tập'
      );
    } finally {
      setAssignmentBusy(assignmentId, false);
    }
  }

  async function handleSaveAssignmentNotes(assignment: TherapistAssignment) {
    if (typeof assignment.id === 'undefined') {
      return;
    }

    const assignmentId = Number(assignment.id);

    try {
      setSupportError(null);
      setAssignmentBusy(assignmentId, true);
      const response = await updateTherapistAssignmentProgress(assignmentId, {
        checked_item_ids: assignment.checked_item_ids,
        completion_notes: noteDrafts[assignmentId] ?? '',
      });

      if (response.assignment) {
        updateAssignmentState(response.assignment);
      }
    } catch (assignmentError) {
      setSupportError(
        assignmentError instanceof Error
          ? assignmentError.message
          : 'Không lưu được ghi chú bài tập'
      );
    } finally {
      setAssignmentBusy(assignmentId, false);
    }
  }

  async function handleUploadAssignmentFiles(
    assignment: TherapistAssignment,
    fileList: FileList | null
  ) {
    if (!fileList || typeof assignment.id === 'undefined') {
      return;
    }

    const assignmentId = Number(assignment.id);

    try {
      setSupportError(null);
      setAssignmentBusy(assignmentId, true);
      const response = await uploadAssignmentAttachments(assignmentId, Array.from(fileList));

      if (response.assignment) {
        updateAssignmentState(response.assignment);
      }
    } catch (assignmentError) {
      setSupportError(
        assignmentError instanceof Error ? assignmentError.message : 'Không tải được tệp bài tập'
      );
    } finally {
      setAssignmentBusy(assignmentId, false);
    }
  }

  async function handleCompleteAssignment(assignment: TherapistAssignment) {
    if (typeof assignment.id === 'undefined') {
      return;
    }

    const assignmentId = Number(assignment.id);

    try {
      setSupportError(null);
      setAssignmentBusy(assignmentId, true);
      const response = await completeTherapistAssignment(
        assignmentId,
        noteDrafts[assignmentId] ?? assignment.completion_notes ?? ''
      );

      if (response.assignment) {
        updateAssignmentState(response.assignment);
      }
    } catch (assignmentError) {
      setSupportError(
        assignmentError instanceof Error ? assignmentError.message : 'Không cập nhật được bài tập'
      );
    } finally {
      setAssignmentBusy(assignmentId, false);
    }
  }

  return {
    userId,
    therapist,
    goals,
    journals,
    streak,
    lastScore,
    proactiveMessage,
    therapistAssignments,
    appointments,
    messages,
    isLoading,
    resolvedError,
    newGoalTitle,
    setNewGoalTitle,
    isSubmittingGoal,
    messageDraft,
    setMessageDraft,
    isSendingMessage,
    assignmentBusyMap,
    noteDrafts,
    setNoteDraft,
    handleToggleGoal,
    handleCreateGoal,
    handleSendTherapistMessage,
    handleConfirmAppointment,
    handleToggleChecklist,
    handleSaveAssignmentNotes,
    handleUploadAssignmentFiles,
    handleCompleteAssignment,
  };
}
