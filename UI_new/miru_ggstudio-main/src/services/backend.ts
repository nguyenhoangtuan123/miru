import {
  AppointmentMutationResponseSchema,
  AppointmentsResponseSchema,
  ChatMessagesResponseSchema,
  ChatSessionsResponseSchema,
  ChatTitleResponseSchema,
  CheckinStatusResponseSchema,
  CreatedSessionResponseSchema,
  CreateSessionWithMessageSchema,
  CurrentUserResponseSchema,
  DailyMoodCheckinResponseSchema,
  DailyMoodCheckinSchema,
  GoalMutationResponseSchema,
  GoalPayloadSchema,
  GoalsResponseSchema,
  GoalUpdateSchema,
  JournalEntrySchema,
  JournalListResponseSchema,
  JournalSaveResponseSchema,
  LogoutResponseSchema,
  MemoryGraphResponseSchema,
  MemoryListResponseSchema,
  MemoryPatternsResponseSchema,
  MomentsResponseSchema,
  ProactiveMessageResponseSchema,
  PushConfigResponseSchema,
  SetRoleResponseSchema,
  SimpleSuccessResponseSchema,
  TherapistAssignmentsResponseSchema,
  TherapistAssignmentMutationResponseSchema,
  TherapistClientsResponseSchema,
  TherapistClientSummaryResponseSchema,
  TherapistConversationsResponseSchema,
  TherapistCrisisMutationResponseSchema,
  TherapistCrisesResponseSchema,
  TherapistInfoResponseSchema,
  TherapistMessageMutationResponseSchema,
  TherapistMessagesResponseSchema,
  TherapistPairingResponseSchema,
  TherapistUnreadCountResponseSchema,
  TimelineResponseSchema,
  UserSchema,
  WsChatRequestSchema,
  WsServerEventSchema,
  type WsServerEvent,
} from './contracts';
import { api, buildWsUrl, parseApi } from './api';

type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

const responseCache = new Map<string, CacheEntry<unknown>>();

const CACHE_TTL = {
  short: 5_000,
  medium: 15_000,
  long: 30_000,
} as const;

function makeCacheKey(...parts: Array<string | number | boolean | undefined | null>) {
  return parts
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => String(part))
    .join('::');
}

async function withCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = responseCache.get(key) as CacheEntry<T> | undefined;

  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }

  if (existing?.promise) {
    return existing.promise;
  }

  const promise = fetcher()
    .then((value) => {
      responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((error) => {
      const current = responseCache.get(key) as CacheEntry<T> | undefined;
      if (current?.promise === promise) {
        responseCache.delete(key);
      }
      throw error;
    });

  responseCache.set(key, {
    value: existing?.value,
    expiresAt: existing?.expiresAt ?? 0,
    promise,
  });

  return promise;
}

function invalidateCacheByPrefix(...prefixes: string[]) {
  if (!prefixes.length) {
    return;
  }

  for (const key of responseCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      responseCache.delete(key);
    }
  }
}

function therapistCachePrefix(therapistId: string) {
  return makeCacheKey('therapist', therapistId);
}

function clientCachePrefix(clientId: string) {
  return makeCacheKey('client', clientId);
}

export async function getAuthMe() {
  return parseApi(api.get('/auth/me'), UserSchema);
}

export async function getCurrentUser() {
  return parseApi(api.get('/api/user/me'), CurrentUserResponseSchema);
}

export async function logout() {
  return parseApi(api.post('/auth/logout'), LogoutResponseSchema);
}

export async function setUserRole(role: 'client' | 'therapist') {
  return parseApi(
    api.post('/api/user/role', { role }),
    SetRoleResponseSchema
  );
}

export async function getPushConfig() {
  return parseApi(api.get('/api/push/config'), PushConfigResponseSchema);
}

export async function savePushSubscription(subscription: unknown) {
  return parseApi(api.post('/api/push/subscribe', subscription), SimpleSuccessResponseSchema);
}

export async function removePushSubscription(endpoint: string) {
  return parseApi(api.post('/api/push/unsubscribe', { endpoint }), SimpleSuccessResponseSchema);
}

export async function getChatSessions(userId: string) {
  return parseApi(api.get(`/api/chat/sessions/${userId}`), ChatSessionsResponseSchema);
}

export async function createChatSession(userId: string, title?: string) {
  return parseApi(
    api.post(`/api/chat/sessions/${userId}`, undefined, {
      params: title ? { title } : undefined,
    }),
    CreatedSessionResponseSchema
  );
}

export async function createSessionWithMessage(payload: unknown) {
  return parseApi(
    api.post(
      '/api/chat/sessions/create-with-message',
      CreateSessionWithMessageSchema.parse(payload)
    ),
    CreatedSessionResponseSchema
  );
}

export async function getSessionMessages(sessionId: string | number) {
  return parseApi(
    api.get(`/api/chat/sessions/${sessionId}/messages`),
    ChatMessagesResponseSchema
  );
}

export async function generateChatTitle(
  sessionId: string | number,
  messages: Array<{ role: string; content: string }>
) {
  return parseApi(
    api.post(`/api/chat/sessions/${sessionId}/generate-title`, { messages }),
    ChatTitleResponseSchema
  );
}

export function connectChatSocket(
  userId: string,
  onEvent: (event: WsServerEvent) => void
) {
  const socket = new WebSocket(buildWsUrl(`/ws/chat/${userId}`));

  socket.onmessage = (event) => {
    const parsed = WsServerEventSchema.parse(JSON.parse(event.data));
    onEvent(parsed);
  };

  return {
    socket,
    send(payload: unknown) {
      const parsed = WsChatRequestSchema.parse(payload);
      socket.send(JSON.stringify(parsed));
    },
    close() {
      socket.close();
    },
  };
}

export async function getMemories(userId: string) {
  return parseApi(api.get(`/api/memories/${userId}`), MemoryListResponseSchema);
}

export async function searchMemories(userId: string, query: string, limit = 10) {
  return parseApi(
    api.get(`/api/memories/${userId}/search`, { params: { q: query, limit } }),
    MemoryListResponseSchema
  );
}

export async function getMemoryGraph(userId: string) {
  return parseApi(api.get(`/api/memories/${userId}/graph`), MemoryGraphResponseSchema);
}

export async function getMemoryPatterns(userId: string) {
  return parseApi(
    api.get(`/api/memories/${userId}/patterns`),
    MemoryPatternsResponseSchema
  );
}

export async function deleteAllMemories(userId: string) {
  return parseApi(api.delete(`/api/memories/${userId}`), SimpleSuccessResponseSchema);
}

export async function getTimeline(userId: string) {
  return parseApi(
    api.get(`/api/insights/timeline/${userId}`),
    TimelineResponseSchema
  );
}

export async function getJournalEntries(userId: string, limit = 10) {
  return withCache(
    makeCacheKey('journal', userId, limit),
    CACHE_TTL.medium,
    () =>
      parseApi(
        api.get(`/api/journal/${userId}`, { params: { limit } }),
        JournalListResponseSchema
      )
  );
}

export async function saveJournalEntry(payload: unknown) {
  const parsed = JournalEntrySchema.parse(payload);
  const response = await parseApi(
    api.post('/api/journal/save', parsed),
    JournalSaveResponseSchema
  );
  invalidateCacheByPrefix(makeCacheKey('journal', parsed.user_id));
  return response;
}

export async function getGoals(userId: string, completed?: boolean) {
  return withCache(
    makeCacheKey('goals', userId, completed ?? 'all'),
    CACHE_TTL.medium,
    () =>
      parseApi(
        api.get(`/api/goals/${userId}`, {
          params: completed === undefined ? undefined : { completed },
        }),
        GoalsResponseSchema
      )
  );
}

export async function createGoal(payload: unknown) {
  const parsed = GoalPayloadSchema.parse(payload);
  const response = await parseApi(
    api.post('/api/goals', parsed),
    GoalMutationResponseSchema
  );
  invalidateCacheByPrefix(makeCacheKey('goals', parsed.user_id));
  return response;
}

export async function updateGoal(goalId: number, payload: unknown) {
  const response = await parseApi(
    api.put(`/api/goals/${goalId}`, GoalUpdateSchema.parse(payload)),
    GoalMutationResponseSchema
  );
  if (response.goal?.user_id) {
    invalidateCacheByPrefix(makeCacheKey('goals', String(response.goal.user_id)));
  } else {
    invalidateCacheByPrefix('goals');
  }
  return response;
}

export async function getCheckinStatus(userId: string) {
  return withCache(
    makeCacheKey('checkin', userId),
    CACHE_TTL.short,
    () =>
      parseApi(
        api.get(`/api/moment/checkin-status/${userId}`),
        CheckinStatusResponseSchema
      )
  );
}

export async function getProactiveMessage(userId: string) {
  return withCache(
    makeCacheKey('proactive', userId),
    CACHE_TTL.short,
    () =>
      parseApi(
        api.get(`/api/moment/proactive-message/${userId}`),
        ProactiveMessageResponseSchema
      )
  );
}

export async function getMoments(userId: string, days = 7) {
  return parseApi(
    api.get(`/api/moments/${userId}`, { params: { days } }),
    MomentsResponseSchema
  );
}

export async function saveDailyMoodCheckin(payload: unknown) {
  const parsed = DailyMoodCheckinSchema.parse(payload);
  const response = await parseApi(
    api.post('/api/moment/daily-checkin', parsed),
    DailyMoodCheckinResponseSchema
  );
  invalidateCacheByPrefix(
    makeCacheKey('checkin', parsed.user_id),
    makeCacheKey('proactive', parsed.user_id)
  );
  return response;
}

export async function getTherapistInfo(therapistId: string) {
  const response = await withCache(
    makeCacheKey(therapistCachePrefix(therapistId), 'info'),
    CACHE_TTL.long,
    () =>
      parseApi(
        api.get(`/api/therapist/me/${therapistId}`),
        TherapistInfoResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc thong tin therapist');
  }
  return response;
}

export async function getTherapistClients(therapistId: string) {
  const response = await withCache(
    makeCacheKey(therapistCachePrefix(therapistId), 'clients'),
    CACHE_TTL.medium,
    () =>
      parseApi(
        api.get(`/api/therapist/clients/${therapistId}`),
        TherapistClientsResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc danh sach than chu');
  }
  return response;
}

export async function getTherapistAssignments(therapistId: string) {
  const response = await withCache(
    makeCacheKey(therapistCachePrefix(therapistId), 'assignments'),
    CACHE_TTL.medium,
    () =>
      parseApi(
        api.get(`/api/therapist/assignments/${therapistId}`),
        TherapistAssignmentsResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc assignments');
  }
  return response;
}

export async function createTherapistAssignment(
  therapistId: string,
  payload: {
    client_id: string;
    title: string;
    description: string;
    due_date?: string;
  }
) {
  const response = await parseApi(
    api.post(`/api/therapist/assignments/${therapistId}`, payload),
    TherapistAssignmentMutationResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tao duoc bai tap');
  }
  invalidateCacheByPrefix(
    makeCacheKey(therapistCachePrefix(therapistId), 'assignments'),
    makeCacheKey(therapistCachePrefix(therapistId), 'clients'),
    makeCacheKey(therapistCachePrefix(therapistId), 'client-summary', payload.client_id),
    makeCacheKey(clientCachePrefix(payload.client_id), 'assignments')
  );
  return response;
}

export async function getTherapistCrises(therapistId: string) {
  const response = await withCache(
    makeCacheKey(therapistCachePrefix(therapistId), 'crises'),
    CACHE_TTL.short,
    () =>
      parseApi(
        api.get(`/api/therapist/crises/${therapistId}`),
        TherapistCrisesResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc crises');
  }
  return response;
}

export async function acknowledgeTherapistCrisis(crisisId: number, notes?: string) {
  const response = await parseApi(
    api.post(`/api/therapist/crises/${crisisId}/acknowledge`, { notes }),
    TherapistCrisisMutationResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong the xac nhan crisis');
  }
  const therapistId =
    typeof response.crisis?.therapist_id === 'string' ? response.crisis.therapist_id : undefined;
  const clientId =
    typeof response.crisis?.client_id === 'string' ? response.crisis.client_id : undefined;
  invalidateCacheByPrefix(
    therapistId ? makeCacheKey(therapistCachePrefix(therapistId), 'crises') : 'therapist',
    therapistId && clientId
      ? makeCacheKey(therapistCachePrefix(therapistId), 'client-summary', clientId)
      : 'therapist'
  );
  return response;
}

export async function getClientAssignments(clientId: string) {
  return withCache(
    makeCacheKey(clientCachePrefix(clientId), 'assignments'),
    CACHE_TTL.medium,
    () =>
      parseApi(
        api.get(`/api/therapist/client/${clientId}/assignments`),
        TherapistAssignmentsResponseSchema
      )
  );
}

export async function completeTherapistAssignment(assignmentId: number, completionNotes?: string) {
  const response = await parseApi(
    api.post(`/api/therapist/assignments/${assignmentId}/complete`, {
      completion_notes: completionNotes,
    }),
    TherapistAssignmentMutationResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong cap nhat duoc bai tap');
  }
  const therapistId = response.assignment?.therapist_id;
  const clientId = response.assignment?.client_id;
  invalidateCacheByPrefix(
    therapistId ? makeCacheKey(therapistCachePrefix(String(therapistId)), 'assignments') : 'therapist',
    clientId ? makeCacheKey(clientCachePrefix(String(clientId)), 'assignments') : 'client',
    therapistId && clientId
      ? makeCacheKey(therapistCachePrefix(String(therapistId)), 'client-summary', String(clientId))
      : 'therapist'
  );
  return response;
}

export async function getClientSummary(therapistId: string, clientId: string) {
  const response = await withCache(
    makeCacheKey(therapistCachePrefix(therapistId), 'client-summary', clientId),
    CACHE_TTL.medium,
    () =>
      parseApi(
        api.get(`/api/therapist/clients/${therapistId}/${clientId}/summary`),
        TherapistClientSummaryResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc tong quan than chu');
  }
  return response;
}

export async function createTherapistPairingCode(therapistId: string) {
  const response = await parseApi(
    api.post(`/api/therapist/clients/${therapistId}/pair-code`),
    TherapistPairingResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tao duoc ma ket noi');
  }
  return response;
}

export async function connectToTherapist(clientId: string, pairingCode: string) {
  const response = await parseApi(
    api.post(`/api/therapist/client/${clientId}/connect`, {
      pairing_code: pairingCode,
    }),
    TherapistPairingResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong ket noi duoc therapist');
  }
  invalidateCacheByPrefix(
    makeCacheKey(clientCachePrefix(clientId)),
    'therapist'
  );
  return response;
}

export async function getClientTherapist(clientId: string) {
  const response = await withCache(
    makeCacheKey(clientCachePrefix(clientId), 'therapist'),
    CACHE_TTL.medium,
    () =>
      parseApi(
        api.get(`/api/therapist/client/${clientId}/therapist`),
        TherapistPairingResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc therapist hien tai');
  }
  return response;
}

export async function getTherapistMessages(therapistId: string, clientId: string, limit = 50) {
  const response = await withCache(
    makeCacheKey(therapistCachePrefix(therapistId), 'messages', clientId, limit),
    CACHE_TTL.short,
    () =>
      parseApi(
        api.get(`/api/therapist/clients/${therapistId}/${clientId}/messages`, {
          params: { limit },
        }),
        TherapistMessagesResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc tin nhan therapist');
  }
  return response;
}

export async function sendTherapistMessage(
  therapistId: string,
  clientId: string,
  messageContent: string
) {
  const response = await parseApi(
    api.post(`/api/therapist/clients/${therapistId}/${clientId}/messages`, {
      message_content: messageContent,
    }),
    TherapistMessageMutationResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong gui duoc tin nhan therapist');
  }
  invalidateCacheByPrefix(
    makeCacheKey(therapistCachePrefix(therapistId), 'messages', clientId),
    makeCacheKey(therapistCachePrefix(therapistId), 'conversations'),
    makeCacheKey(therapistCachePrefix(therapistId), 'unread'),
    makeCacheKey(clientCachePrefix(clientId), 'messages')
  );
  return response;
}

export async function markTherapistMessagesRead(therapistId: string, clientId: string) {
  const response = await parseApi(
    api.post(`/api/therapist/clients/${therapistId}/${clientId}/messages/mark-read`),
    SimpleSuccessResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong danh dau da doc duoc');
  }
  invalidateCacheByPrefix(
    makeCacheKey(therapistCachePrefix(therapistId), 'conversations'),
    makeCacheKey(therapistCachePrefix(therapistId), 'unread')
  );
  return response;
}

export async function getTherapistConversations(therapistId: string, limit = 20) {
  const response = await withCache(
    makeCacheKey(therapistCachePrefix(therapistId), 'conversations', limit),
    CACHE_TTL.short,
    () =>
      parseApi(
        api.get(`/api/therapist/conversations/${therapistId}`, { params: { limit } }),
        TherapistConversationsResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc hoi thoai therapist');
  }
  return response;
}

export async function getTherapistUnreadCount(therapistId: string, clientId?: string) {
  const response = await withCache(
    makeCacheKey(therapistCachePrefix(therapistId), 'unread', clientId ?? 'all'),
    CACHE_TTL.short,
    () =>
      parseApi(
        api.get(`/api/therapist/unread-count/${therapistId}`, {
          params: clientId ? { client_id: clientId } : undefined,
        }),
        TherapistUnreadCountResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc unread count');
  }
  return response;
}

export async function getClientTherapistMessages(clientId: string, limit = 50) {
  const response = await withCache(
    makeCacheKey(clientCachePrefix(clientId), 'messages', limit),
    CACHE_TTL.short,
    () =>
      parseApi(
        api.get(`/api/therapist/client/${clientId}/messages`, { params: { limit } }),
        TherapistMessagesResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc tin nhan');
  }
  return response;
}

export async function sendClientTherapistMessage(clientId: string, messageContent: string) {
  const response = await parseApi(
    api.post(`/api/therapist/client/${clientId}/messages`, {
      message_content: messageContent,
    }),
    TherapistMessageMutationResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong gui duoc tin nhan');
  }
  invalidateCacheByPrefix(
    makeCacheKey(clientCachePrefix(clientId), 'messages'),
    makeCacheKey(clientCachePrefix(clientId), 'therapist')
  );
  return response;
}

export async function markClientTherapistMessagesRead(clientId: string) {
  const response = await parseApi(
    api.post(`/api/therapist/client/${clientId}/messages/mark-read`),
    SimpleSuccessResponseSchema
  );
  invalidateCacheByPrefix(makeCacheKey(clientCachePrefix(clientId), 'messages'));
  return response;
}

export async function getTherapistAppointments(therapistId: string, clientId?: string, status?: string) {
  const response = await withCache(
    makeCacheKey(therapistCachePrefix(therapistId), 'appointments', clientId ?? 'all', status ?? 'all'),
    CACHE_TTL.medium,
    () =>
      parseApi(
        api.get(`/api/therapist/appointments/${therapistId}`, {
          params: {
            ...(clientId ? { client_id: clientId } : {}),
            ...(status ? { status } : {}),
          },
        }),
        AppointmentsResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc lich hen therapist');
  }
  return response;
}

export async function createTherapistAppointment(
  therapistId: string,
  payload: {
    client_id: string;
    appointment_date: string;
    duration_minutes?: number;
    appointment_type?: string;
    location?: string;
    meeting_link?: string;
    notes?: string;
  }
) {
  const response = await parseApi(
    api.post(`/api/therapist/appointments/${therapistId}`, payload),
    AppointmentMutationResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tao duoc lich hen');
  }
  invalidateCacheByPrefix(
    makeCacheKey(therapistCachePrefix(therapistId), 'appointments'),
    makeCacheKey(therapistCachePrefix(therapistId), 'clients'),
    makeCacheKey(clientCachePrefix(payload.client_id), 'appointments')
  );
  return response;
}

export async function cancelTherapistAppointment(
  therapistId: string,
  appointmentId: number,
  reason?: string
) {
  const response = await parseApi(
    api.post(`/api/therapist/appointments/${therapistId}/${appointmentId}/cancel`, { reason }),
    SimpleSuccessResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong huy duoc lich hen');
  }
  invalidateCacheByPrefix(makeCacheKey(therapistCachePrefix(therapistId), 'appointments'));
  return response;
}

export async function completeTherapistAppointment(therapistId: string, appointmentId: number) {
  const response = await parseApi(
    api.post(`/api/therapist/appointments/${therapistId}/${appointmentId}/complete`),
    SimpleSuccessResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong hoan tat duoc lich hen');
  }
  invalidateCacheByPrefix(makeCacheKey(therapistCachePrefix(therapistId), 'appointments'));
  return response;
}

export async function getClientAppointments(clientId: string) {
  const response = await withCache(
    makeCacheKey(clientCachePrefix(clientId), 'appointments'),
    CACHE_TTL.medium,
    () =>
      parseApi(
        api.get(`/api/therapist/client/${clientId}/appointments`),
        AppointmentsResponseSchema
      )
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong tai duoc lich hen cua than chu');
  }
  return response;
}

export async function confirmClientAppointment(clientId: string, appointmentId: number) {
  const response = await parseApi(
    api.post(`/api/therapist/client/${clientId}/appointments/${appointmentId}/confirm`),
    SimpleSuccessResponseSchema
  );
  if (!response.success) {
    throw new Error(response.error ?? 'Khong xac nhan duoc lich hen');
  }
  invalidateCacheByPrefix(makeCacheKey(clientCachePrefix(clientId), 'appointments'));
  return response;
}
