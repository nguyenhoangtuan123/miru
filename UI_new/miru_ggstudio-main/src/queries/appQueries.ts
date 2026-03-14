import { queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  getCheckinStatus,
  getClientAppointments,
  getClientAssignments,
  getClientTherapist,
  getClientTherapistMessages,
  getConsentStatus,
  getGoals,
  getJournalEntries,
  getMoments,
  getProactiveMessage,
  getTherapistAppointments,
  getTherapistAssignments,
  getTherapistClientAssignments,
  getTherapistClients,
  getTherapistConversations,
  getTherapistCrises,
  getTherapistMessages,
} from '../services/backend';
import {
  getMyClientProfile,
  getMyTherapistProfile,
  getPublicTherapists,
  getTherapistViewOfClientProfile,
} from '../services/profiles';
import { getClientSummary } from '../services/backend';

export const queryKeys = {
  consent: {
    status: () => ['consent', 'status'] as const,
  },
  journal: {
    all: (userId: string) => ['journal', userId] as const,
    list: (userId: string, limit: number) => ['journal', userId, 'list', limit] as const,
  },
  moments: {
    all: (userId: string) => ['moments', userId] as const,
    list: (userId: string, days: number) => ['moments', userId, 'list', days] as const,
  },
  checkin: {
    status: (userId: string) => ['checkin', userId, 'status'] as const,
  },
  proactive: {
    message: (userId: string) => ['proactive', userId, 'message'] as const,
  },
  goals: {
    all: (userId: string) => ['goals', userId] as const,
    list: (userId: string, completed?: boolean) =>
      ['goals', userId, 'list', completed ?? 'all'] as const,
  },
  profiles: {
    clientMe: () => ['profiles', 'client', 'me'] as const,
    therapistMe: () => ['profiles', 'therapist', 'me'] as const,
    publicTherapists: (limit?: number) =>
      ['profiles', 'therapists', 'public', limit ?? 'all'] as const,
    clientDetail: (clientId: string) => ['profiles', 'client', clientId] as const,
  },
  clientTherapist: {
    detail: (clientId: string) => ['client-therapist', clientId] as const,
    messages: (clientId: string, limit: number) =>
      ['client-therapist', clientId, 'messages', limit] as const,
    appointments: (clientId: string) =>
      ['client-therapist', clientId, 'appointments'] as const,
    assignments: (clientId: string) =>
      ['client-therapist', clientId, 'assignments'] as const,
  },
  therapist: {
    clients: (therapistId: string) => ['therapist', therapistId, 'clients'] as const,
    assignments: (therapistId: string) => ['therapist', therapistId, 'assignments'] as const,
    crises: (therapistId: string) => ['therapist', therapistId, 'crises'] as const,
    conversations: (therapistId: string, limit: number) =>
      ['therapist', therapistId, 'conversations', limit] as const,
    messages: (therapistId: string, clientId: string, limit: number) =>
      ['therapist', therapistId, 'messages', clientId, limit] as const,
    appointments: (therapistId: string, clientId?: string, status?: string) =>
      ['therapist', therapistId, 'appointments', clientId ?? 'all', status ?? 'all'] as const,
    clientSummary: (therapistId: string, clientId: string) =>
      ['therapist', therapistId, 'client-summary', clientId] as const,
    clientAssignments: (therapistId: string, clientId: string) =>
      ['therapist', therapistId, 'client-assignments', clientId] as const,
  },
};

export function consentStatusQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.consent.status(),
    queryFn: getConsentStatus,
  });
}

export function journalEntriesQueryOptions(userId: string, limit: number) {
  return queryOptions({
    queryKey: queryKeys.journal.list(userId, limit),
    queryFn: () => getJournalEntries(userId, limit),
  });
}

export function momentsQueryOptions(userId: string, days: number) {
  return queryOptions({
    queryKey: queryKeys.moments.list(userId, days),
    queryFn: () => getMoments(userId, days),
  });
}

export function checkinStatusQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.checkin.status(userId),
    queryFn: () => getCheckinStatus(userId),
  });
}

export function proactiveMessageQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.proactive.message(userId),
    queryFn: () => getProactiveMessage(userId),
  });
}

export function goalsQueryOptions(userId: string, completed?: boolean) {
  return queryOptions({
    queryKey: queryKeys.goals.list(userId, completed),
    queryFn: () => getGoals(userId, completed),
  });
}

export function clientProfileQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.profiles.clientMe(),
    queryFn: getMyClientProfile,
  });
}

export function therapistProfileQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.profiles.therapistMe(),
    queryFn: getMyTherapistProfile,
  });
}

export function publicTherapistsQueryOptions(limit?: number) {
  return queryOptions({
    queryKey: queryKeys.profiles.publicTherapists(limit),
    queryFn: () => getPublicTherapists(limit),
  });
}

export function therapistClientProfileQueryOptions(clientId: string) {
  return queryOptions({
    queryKey: queryKeys.profiles.clientDetail(clientId),
    queryFn: () => getTherapistViewOfClientProfile(clientId),
  });
}

export function clientTherapistQueryOptions(clientId: string) {
  return queryOptions({
    queryKey: queryKeys.clientTherapist.detail(clientId),
    queryFn: () => getClientTherapist(clientId),
  });
}

export function clientTherapistMessagesQueryOptions(clientId: string, limit = 50) {
  return queryOptions({
    queryKey: queryKeys.clientTherapist.messages(clientId, limit),
    queryFn: () => getClientTherapistMessages(clientId, limit),
  });
}

export function clientAppointmentsQueryOptions(clientId: string) {
  return queryOptions({
    queryKey: queryKeys.clientTherapist.appointments(clientId),
    queryFn: () => getClientAppointments(clientId),
  });
}

export function clientAssignmentsQueryOptions(clientId: string) {
  return queryOptions({
    queryKey: queryKeys.clientTherapist.assignments(clientId),
    queryFn: () => getClientAssignments(clientId),
  });
}

export function therapistClientsQueryOptions(therapistId: string) {
  return queryOptions({
    queryKey: queryKeys.therapist.clients(therapistId),
    queryFn: () => getTherapistClients(therapistId),
  });
}

export function therapistAssignmentsQueryOptions(therapistId: string) {
  return queryOptions({
    queryKey: queryKeys.therapist.assignments(therapistId),
    queryFn: () => getTherapistAssignments(therapistId),
  });
}

export function therapistCrisesQueryOptions(therapistId: string) {
  return queryOptions({
    queryKey: queryKeys.therapist.crises(therapistId),
    queryFn: () => getTherapistCrises(therapistId),
  });
}

export function therapistConversationsQueryOptions(therapistId: string, limit = 20) {
  return queryOptions({
    queryKey: queryKeys.therapist.conversations(therapistId, limit),
    queryFn: () => getTherapistConversations(therapistId, limit),
  });
}

export function therapistMessagesQueryOptions(therapistId: string, clientId: string, limit = 50) {
  return queryOptions({
    queryKey: queryKeys.therapist.messages(therapistId, clientId, limit),
    queryFn: () => getTherapistMessages(therapistId, clientId, limit),
  });
}

export function therapistAppointmentsQueryOptions(
  therapistId: string,
  clientId?: string,
  status?: string
) {
  return queryOptions({
    queryKey: queryKeys.therapist.appointments(therapistId, clientId, status),
    queryFn: () => getTherapistAppointments(therapistId, clientId, status),
  });
}

export function therapistClientSummaryQueryOptions(therapistId: string, clientId: string) {
  return queryOptions({
    queryKey: queryKeys.therapist.clientSummary(therapistId, clientId),
    queryFn: () => getClientSummary(therapistId, clientId),
  });
}

export function therapistClientAssignmentsQueryOptions(therapistId: string, clientId: string) {
  return queryOptions({
    queryKey: queryKeys.therapist.clientAssignments(therapistId, clientId),
    queryFn: () => getTherapistClientAssignments(therapistId, clientId),
  });
}

export async function prefetchClientRouteData(
  queryClient: QueryClient,
  path: string,
  userId?: string | null
) {
  const tasks: Array<Promise<unknown>> = [];

  if (path === '/') {
    tasks.push(queryClient.prefetchQuery(publicTherapistsQueryOptions(3)));
    if (userId) {
      tasks.push(queryClient.prefetchQuery(journalEntriesQueryOptions(userId, 5)));
      tasks.push(queryClient.prefetchQuery(momentsQueryOptions(userId, 7)));
      tasks.push(queryClient.prefetchQuery(checkinStatusQueryOptions(userId)));
      tasks.push(queryClient.prefetchQuery(proactiveMessageQueryOptions(userId)));
    }
  }

  if (!userId) {
    await Promise.all(tasks);
    return;
  }

  if (path === '/therapy') {
    tasks.push(queryClient.prefetchQuery(goalsQueryOptions(userId)));
    tasks.push(queryClient.prefetchQuery(journalEntriesQueryOptions(userId, 3)));
    tasks.push(queryClient.prefetchQuery(checkinStatusQueryOptions(userId)));
    tasks.push(queryClient.prefetchQuery(proactiveMessageQueryOptions(userId)));
    tasks.push(queryClient.prefetchQuery(clientTherapistQueryOptions(userId)));
    tasks.push(queryClient.prefetchQuery(clientAssignmentsQueryOptions(userId)));
    tasks.push(queryClient.prefetchQuery(clientAppointmentsQueryOptions(userId)));
    tasks.push(queryClient.prefetchQuery(clientTherapistMessagesQueryOptions(userId)));
  }

  if (path === '/profile') {
    tasks.push(queryClient.prefetchQuery(clientProfileQueryOptions()));
  }

  if (path === '/therapists') {
    tasks.push(queryClient.prefetchQuery(publicTherapistsQueryOptions()));
  }

  await Promise.all(tasks);
}

export async function prefetchTherapistRouteData(
  queryClient: QueryClient,
  path: string,
  therapistId?: string | null
) {
  if (!therapistId) {
    return;
  }

  const tasks: Array<Promise<unknown>> = [];

  if (path === '/therapist') {
    tasks.push(queryClient.prefetchQuery(therapistClientsQueryOptions(therapistId)));
    tasks.push(queryClient.prefetchQuery(therapistAssignmentsQueryOptions(therapistId)));
    tasks.push(queryClient.prefetchQuery(therapistCrisesQueryOptions(therapistId)));
  }

  if (path === '/therapist/clients' || path === '/therapist/client-profiles') {
    tasks.push(queryClient.prefetchQuery(therapistClientsQueryOptions(therapistId)));
  }

  if (path === '/therapist/messages') {
    tasks.push(queryClient.prefetchQuery(therapistClientsQueryOptions(therapistId)));
    tasks.push(queryClient.prefetchQuery(therapistConversationsQueryOptions(therapistId)));
    tasks.push(queryClient.prefetchQuery(therapistCrisesQueryOptions(therapistId)));
  }

  if (path === '/therapist/appointments') {
    tasks.push(queryClient.prefetchQuery(therapistClientsQueryOptions(therapistId)));
    tasks.push(queryClient.prefetchQuery(therapistAppointmentsQueryOptions(therapistId)));
  }

  if (path === '/therapist/profile') {
    tasks.push(queryClient.prefetchQuery(therapistProfileQueryOptions()));
  }

  await Promise.all(tasks);
}
