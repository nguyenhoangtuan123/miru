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
  getTherapistMorningBoard,
  getTherapistMessages,
} from '../services/backend';
import {
  getMyTherapistBillingProfile,
  getMyTherapistContactRequests,
  getMyClientProfile,
  getPublicTherapist,
  getMyTherapistProfile,
  getPublicTherapists,
  getTherapistContactRequests,
  getTherapistViewOfClientProfile,
} from '../services/profiles';
import {
  getAssessmentTemplates,
  getMyAssessmentDetail,
  getMyAssessments,
  getTherapistAssessmentDetail,
  getTherapistClientAssessments,
} from '../services/assessments';
import {
  getAdminArticleReviews,
  getMyTherapistArticleAnalytics,
  getMyTherapistArticles,
  getPublicArticle,
  getPublicArticles,
} from '../services/articles';
import {
  getMyTherapistSharingPreferences,
  getTherapistSharedActivities,
  getTherapistSharedAssessments,
  getTherapistSharedChat,
  getTherapistSharedContextOverview,
  getTherapistSharedInsights,
} from '../services/therapistSharing';
import {
  getMyCurrentTreatmentProgram,
  getTherapistTreatmentProgram,
} from '../services/treatmentPrograms';
import { getClientSummary } from '../services/backend';
import { getMyIntakeProfile } from '../services/intake';
import { getMyTrajectorySummary } from '../services/trajectory';

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
    publicTherapistDetail: (therapistId: string) =>
      ['profiles', 'therapists', 'public', 'detail', therapistId] as const,
    clientDetail: (clientId: string) => ['profiles', 'client', clientId] as const,
    therapistBilling: () => ['profiles', 'therapist', 'billing'] as const,
  },
  contactRequests: {
    clientMe: () => ['contact-requests', 'client', 'me'] as const,
    therapistInbox: (status?: string) => ['contact-requests', 'therapist', status ?? 'all'] as const,
  },
  assessments: {
    templates: () => ['assessments', 'templates'] as const,
    myAssignments: () => ['assessments', 'client', 'me'] as const,
    myAssignmentDetail: (assignmentId: string) =>
      ['assessments', 'client', 'me', assignmentId] as const,
    therapistClientAssignments: (therapistId: string, clientId: string) =>
      ['assessments', 'therapist', therapistId, 'client', clientId] as const,
    therapistAssignmentDetail: (therapistId: string, clientId: string, assignmentId: string) =>
      ['assessments', 'therapist', therapistId, 'client', clientId, assignmentId] as const,
  },
  articles: {
    public: (limit?: number) => ['articles', 'public', limit ?? 'all'] as const,
    publicDetail: (slug: string) => ['articles', 'public', 'detail', slug] as const,
    therapistMe: () => ['articles', 'therapist', 'me'] as const,
    therapistAnalytics: () => ['articles', 'therapist', 'analytics'] as const,
    therapistDetail: (articleId: string | number) => ['articles', 'therapist', String(articleId)] as const,
    adminReview: () => ['articles', 'admin', 'review'] as const,
  },
  therapistSharing: {
    myPreferences: () => ['therapist-sharing', 'client', 'me'] as const,
    overview: (clientId: string) => ['therapist-sharing', 'therapist', 'overview', clientId] as const,
    chat: (clientId: string) => ['therapist-sharing', 'therapist', 'chat', clientId] as const,
    activities: (clientId: string) => ['therapist-sharing', 'therapist', 'activities', clientId] as const,
    assessments: (clientId: string) => ['therapist-sharing', 'therapist', 'assessments', clientId] as const,
    insights: (clientId: string) => ['therapist-sharing', 'therapist', 'insights', clientId] as const,
  },
  treatmentPrograms: {
    clientCurrent: () => ['treatment-programs', 'client', 'current'] as const,
    therapistClient: (clientId: string) => ['treatment-programs', 'therapist', 'client', clientId] as const,
  },
  intake: {
    me: () => ['intake', 'me'] as const,
  },
  trajectory: {
    summary: () => ['trajectory', 'summary'] as const,
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
    morningBoard: (therapistId: string) => ['therapist', therapistId, 'morning-board'] as const,
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
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function publicTherapistsQueryOptions(limit?: number) {
  return queryOptions({
    queryKey: queryKeys.profiles.publicTherapists(limit),
    queryFn: () => getPublicTherapists(limit),
  });
}

export function publicTherapistDetailQueryOptions(therapistId: string) {
  return queryOptions({
    queryKey: queryKeys.profiles.publicTherapistDetail(therapistId),
    queryFn: () => getPublicTherapist(therapistId),
  });
}

export function therapistBillingProfileQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.profiles.therapistBilling(),
    queryFn: getMyTherapistBillingProfile,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function myContactRequestsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.contactRequests.clientMe(),
    queryFn: getMyTherapistContactRequests,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function therapistContactRequestsQueryOptions(status?: string) {
  return queryOptions({
    queryKey: queryKeys.contactRequests.therapistInbox(status),
    queryFn: () => getTherapistContactRequests(status),
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
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

export function therapistMorningBoardQueryOptions(therapistId: string) {
  return queryOptions({
    queryKey: queryKeys.therapist.morningBoard(therapistId),
    queryFn: () => getTherapistMorningBoard(therapistId),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
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

export function assessmentTemplatesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.assessments.templates(),
    queryFn: getAssessmentTemplates,
  });
}

export function myAssessmentsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.assessments.myAssignments(),
    queryFn: getMyAssessments,
  });
}

export function myAssessmentDetailQueryOptions(assignmentId: string) {
  return queryOptions({
    queryKey: queryKeys.assessments.myAssignmentDetail(assignmentId),
    queryFn: () => getMyAssessmentDetail(assignmentId),
  });
}

export function therapistClientAssessmentsQueryOptions(therapistId: string, clientId: string) {
  return queryOptions({
    queryKey: queryKeys.assessments.therapistClientAssignments(therapistId, clientId),
    queryFn: () => getTherapistClientAssessments(clientId),
  });
}

export function therapistAssessmentDetailQueryOptions(
  therapistId: string,
  clientId: string,
  assignmentId: string
) {
  return queryOptions({
    queryKey: queryKeys.assessments.therapistAssignmentDetail(therapistId, clientId, assignmentId),
    queryFn: () => getTherapistAssessmentDetail(clientId, assignmentId),
  });
}

export function publicArticlesQueryOptions(limit?: number) {
  return queryOptions({
    queryKey: queryKeys.articles.public(limit),
    queryFn: () => getPublicArticles(limit),
  });
}

export function publicArticleQueryOptions(slug: string) {
  return queryOptions({
    queryKey: queryKeys.articles.publicDetail(slug),
    queryFn: () => getPublicArticle(slug),
  });
}

export function myTherapistArticlesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.articles.therapistMe(),
    queryFn: getMyTherapistArticles,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function myTherapistArticleAnalyticsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.articles.therapistAnalytics(),
    queryFn: getMyTherapistArticleAnalytics,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function adminArticleReviewQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.articles.adminReview(),
    queryFn: getAdminArticleReviews,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function myTherapistSharingPreferencesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.therapistSharing.myPreferences(),
    queryFn: getMyTherapistSharingPreferences,
    staleTime: 2 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });
}

export function therapistSharedContextOverviewQueryOptions(clientId: string) {
  return queryOptions({
    queryKey: queryKeys.therapistSharing.overview(clientId),
    queryFn: () => getTherapistSharedContextOverview(clientId),
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function therapistSharedChatQueryOptions(clientId: string, isAiReport = false) {
  return queryOptions({
    queryKey: [...queryKeys.therapistSharing.chat(clientId), isAiReport ? 'ai-report' : 'raw'] as const,
    queryFn: () => getTherapistSharedChat(clientId),
    staleTime: isAiReport ? 10 * 60 * 1000 : 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });
}

export function therapistSharedActivitiesQueryOptions(clientId: string, isAiReport = false) {
  return queryOptions({
    queryKey: [...queryKeys.therapistSharing.activities(clientId), isAiReport ? 'ai-report' : 'raw'] as const,
    queryFn: () => getTherapistSharedActivities(clientId),
    staleTime: isAiReport ? 10 * 60 * 1000 : 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });
}

export function therapistSharedAssessmentsQueryOptions(clientId: string, isAiReport = false) {
  return queryOptions({
    queryKey: [...queryKeys.therapistSharing.assessments(clientId), isAiReport ? 'ai-report' : 'raw'] as const,
    queryFn: () => getTherapistSharedAssessments(clientId),
    staleTime: isAiReport ? 10 * 60 * 1000 : 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });
}

export function therapistSharedInsightsQueryOptions(clientId: string, isAiReport = false) {
  return queryOptions({
    queryKey: [...queryKeys.therapistSharing.insights(clientId), isAiReport ? 'ai-report' : 'raw'] as const,
    queryFn: () => getTherapistSharedInsights(clientId),
    staleTime: isAiReport ? 10 * 60 * 1000 : 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });
}

export function myCurrentTreatmentProgramQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.treatmentPrograms.clientCurrent(),
    queryFn: getMyCurrentTreatmentProgram,
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });
}

export function myIntakeProfileQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.intake.me(),
    queryFn: getMyIntakeProfile,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function myTrajectorySummaryQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.trajectory.summary(),
    queryFn: getMyTrajectorySummary,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function therapistTreatmentProgramQueryOptions(clientId: string) {
  return queryOptions({
    queryKey: queryKeys.treatmentPrograms.therapistClient(clientId),
    queryFn: () => getTherapistTreatmentProgram(clientId),
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
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
      tasks.push(queryClient.prefetchQuery(myIntakeProfileQueryOptions()));
      tasks.push(queryClient.prefetchQuery(myTrajectorySummaryQueryOptions()));
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
    tasks.push(queryClient.prefetchQuery(myCurrentTreatmentProgramQueryOptions()));
  }

  if (path === '/profile') {
    tasks.push(queryClient.prefetchQuery(clientProfileQueryOptions()));
  }

  if (path === '/therapists') {
    tasks.push(queryClient.prefetchQuery(publicTherapistsQueryOptions()));
  }

  if (path === '/assessments') {
    tasks.push(queryClient.prefetchQuery(myAssessmentsQueryOptions()));
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
    tasks.push(queryClient.prefetchQuery(therapistMorningBoardQueryOptions(therapistId)));
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
    tasks.push(queryClient.prefetchQuery(therapistBillingProfileQueryOptions()));
  }

  if (path === '/therapist/articles') {
    tasks.push(queryClient.prefetchQuery(myTherapistArticlesQueryOptions()));
    tasks.push(queryClient.prefetchQuery(myTherapistArticleAnalyticsQueryOptions()));
  }

  if (path === '/therapist/contact-requests') {
    tasks.push(queryClient.prefetchQuery(therapistContactRequestsQueryOptions()));
  }

  await Promise.all(tasks);
}
