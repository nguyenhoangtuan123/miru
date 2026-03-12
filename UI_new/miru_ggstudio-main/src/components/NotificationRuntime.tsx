import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePwa } from '../contexts/PwaContext';
import {
  getClientAssignments,
  getClientTherapist,
  getClientTherapistMessages,
  getTherapistConversations,
  getTherapistCrises,
} from '../services/backend';
import { shouldShowSystemNotification, showMiruNotification } from '../lib/notifications';

function getId(value: Record<string, unknown>) {
  const id = value.id;
  if (typeof id === 'string' || typeof id === 'number') {
    return String(id);
  }
  return null;
}

function asArray<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
}

export function NotificationRuntime() {
  const { user } = useAuth();
  const { notificationPermission } = usePwa();
  const bootstrappedRef = useRef(false);
  const therapistUnreadRef = useRef(0);
  const therapistCrisisIdsRef = useRef<Set<string>>(new Set());
  const clientMessageIdsRef = useRef<Set<string>>(new Set());
  const clientAssignmentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id || notificationPermission !== 'granted') {
      bootstrappedRef.current = false;
      therapistUnreadRef.current = 0;
      therapistCrisisIdsRef.current = new Set();
      clientMessageIdsRef.current = new Set();
      clientAssignmentIdsRef.current = new Set();
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        if (user.role === 'therapist') {
          const [conversationsResponse, crisesResponse] = await Promise.all([
            getTherapistConversations(user.id),
            getTherapistCrises(user.id),
          ]);

          if (cancelled) {
            return;
          }

          const conversations = asArray(conversationsResponse.conversations);
          const crises = asArray(crisesResponse.crises);

          const unreadCount = conversations.reduce((total, conversation) => {
            const unread = conversation.unread_count;
            return total + (typeof unread === 'number' ? unread : 0);
          }, 0);

          const crisisIds = new Set(
            crises.map((crisis) => getId(crisis)).filter((value): value is string => Boolean(value))
          );

          if (bootstrappedRef.current && shouldShowSystemNotification()) {
            if (unreadCount > therapistUnreadRef.current) {
              await showMiruNotification({
                title: 'Miru',
                body: 'Co than chu vua gui tin nhan moi cho ban.',
                tag: 'therapist-unread',
                url: '/therapist/messages',
              });
            }

            const newCrisisIds = [...crisisIds].filter((id) => !therapistCrisisIdsRef.current.has(id));
            if (newCrisisIds.length > 0) {
              await showMiruNotification({
                title: 'Canh bao AI',
                body: `Co ${newCrisisIds.length} canh bao moi can nha tri lieu xem ngay.`,
                tag: 'therapist-crisis',
                url: '/therapist/messages',
              });
            }
          }

          therapistUnreadRef.current = unreadCount;
          therapistCrisisIdsRef.current = crisisIds;
        } else {
          const pairingResponse = await getClientTherapist(user.id);
          if (cancelled) {
            return;
          }

          if (!pairingResponse.pairing) {
            clientMessageIdsRef.current = new Set();
            clientAssignmentIdsRef.current = new Set();
            bootstrappedRef.current = true;
            return;
          }

          const [messagesResponse, assignmentsResponse] = await Promise.all([
            getClientTherapistMessages(user.id),
            getClientAssignments(user.id),
          ]);

          if (cancelled) {
            return;
          }

          const therapistMessages = asArray(messagesResponse.messages).filter(
            (message) => message.sender_type === 'therapist'
          );
          const therapistMessageIds = new Set(
            therapistMessages.map((message) => getId(message)).filter((value): value is string => Boolean(value))
          );

          const pendingAssignments = asArray(assignmentsResponse.assignments).filter(
            (assignment) => assignment.status !== 'completed'
          );
          const assignmentIds = new Set(
            pendingAssignments.map((assignment) => getId(assignment)).filter((value): value is string => Boolean(value))
          );

          if (bootstrappedRef.current && shouldShowSystemNotification()) {
            const hasNewTherapistMessage = [...therapistMessageIds].some(
              (id) => !clientMessageIdsRef.current.has(id)
            );
            if (hasNewTherapistMessage) {
              await showMiruNotification({
                title: 'Nha tri lieu',
                body: 'Ban vua nhan duoc tin nhan moi tu nha tri lieu.',
                tag: 'client-therapist-message',
                url: '/therapy',
              });
            }

            const hasNewAssignment = [...assignmentIds].some((id) => !clientAssignmentIdsRef.current.has(id));
            if (hasNewAssignment) {
              await showMiruNotification({
                title: 'Bai tap moi',
                body: 'Nha tri lieu vua giao them bai tap cho ban.',
                tag: 'client-assignment',
                url: '/therapy',
              });
            }
          }

          clientMessageIdsRef.current = therapistMessageIds;
          clientAssignmentIdsRef.current = assignmentIds;
        }

        bootstrappedRef.current = true;
      } catch {
        // Silently ignore polling issues. UI loads these sections separately.
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [notificationPermission, user?.id, user?.role]);

  return null;
}
