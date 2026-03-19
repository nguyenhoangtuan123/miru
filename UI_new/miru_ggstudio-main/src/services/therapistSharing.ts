import { z } from 'zod';
import { api, parseApi } from './api';
import { TrajectorySummarySchema } from './trajectory';

export const SharingAccessLevelSchema = z.enum(['none', 'ai_report', 'direct']);

export const TherapistSharingPreferenceSchema = z
  .object({
    client_id: z.string(),
    therapist_id: z.string(),
    therapist_name: z.string().nullable().optional(),
    therapist_email: z.string().nullable().optional(),
    ai_chat_access: SharingAccessLevelSchema,
    web_activity_access: SharingAccessLevelSchema,
    assessment_access: SharingAccessLevelSchema,
    insights_access: SharingAccessLevelSchema,
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const SharedContextGroupSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    access_level: SharingAccessLevelSchema,
  })
  .passthrough();

export const SharedAiReportSchema = z
  .object({
    source_mode: z.literal('ai_report'),
    summary: z.string(),
    highlights: z.array(z.string()).default([]),
    generated_at: z.string(),
    cache_expires_at: z.string().nullable().optional(),
  })
  .passthrough();

export const SharedRawPayloadSchema = z.record(z.unknown());

export const SharedContextOverviewSchema = z
  .object({
    success: z.boolean(),
    client_id: z.string(),
    client_name: z.string().nullable().optional(),
    therapist_id: z.string(),
    consent: TherapistSharingPreferenceSchema,
    groups: z.array(SharedContextGroupSchema).default([]),
    trajectory_summary: TrajectorySummarySchema.nullable().optional(),
  })
  .passthrough();

export const TherapistSharingPreferencesResponseSchema = z.object({
  success: z.boolean(),
  preferences: z.array(TherapistSharingPreferenceSchema).default([]),
});

export const TherapistSharingPreferenceResponseSchema = z.object({
  success: z.boolean(),
  preference: TherapistSharingPreferenceSchema,
});

export const SharedContextResponseSchema = z
  .object({
    success: z.boolean(),
    client_id: z.string(),
    therapist_id: z.string(),
    group: z.string(),
    access_level: SharingAccessLevelSchema,
    audit_logged: z.boolean(),
    source_mode: z.string().optional(),
    generated_at: z.string().optional(),
    cache_expires_at: z.string().nullable().optional(),
    data: z.union([SharedAiReportSchema, SharedRawPayloadSchema]),
  })
  .passthrough();

export type SharingAccessLevel = z.infer<typeof SharingAccessLevelSchema>;
export type TherapistSharingPreference = z.infer<typeof TherapistSharingPreferenceSchema>;
export type SharedContextOverview = z.infer<typeof SharedContextOverviewSchema>;
export type SharedContextResponse = z.infer<typeof SharedContextResponseSchema>;

export async function getMyTherapistSharingPreferences() {
  return parseApi(api.get('/api/therapist-sharing/me'), TherapistSharingPreferencesResponseSchema);
}

export async function updateMyTherapistSharingPreference(
  therapistId: string,
  payload: Partial<{
    ai_chat_access: SharingAccessLevel;
    web_activity_access: SharingAccessLevel;
    assessment_access: SharingAccessLevel;
    insights_access: SharingAccessLevel;
  }>
) {
  return parseApi(
    api.put(`/api/therapist-sharing/me/${encodeURIComponent(therapistId)}`, payload),
    TherapistSharingPreferenceResponseSchema
  );
}

export async function getTherapistSharedContextOverview(clientId: string) {
  return parseApi(
    api.get(`/api/therapist-shared-context/clients/${encodeURIComponent(clientId)}/overview`),
    SharedContextOverviewSchema
  );
}

export async function getTherapistSharedChat(clientId: string) {
  return parseApi(
    api.get(`/api/therapist-shared-context/clients/${encodeURIComponent(clientId)}/chat`),
    SharedContextResponseSchema
  );
}

export async function getTherapistSharedActivities(clientId: string) {
  return parseApi(
    api.get(`/api/therapist-shared-context/clients/${encodeURIComponent(clientId)}/activities`),
    SharedContextResponseSchema
  );
}

export async function getTherapistSharedAssessments(clientId: string) {
  return parseApi(
    api.get(`/api/therapist-shared-context/clients/${encodeURIComponent(clientId)}/assessments`),
    SharedContextResponseSchema
  );
}

export async function getTherapistSharedInsights(clientId: string) {
  return parseApi(
    api.get(`/api/therapist-shared-context/clients/${encodeURIComponent(clientId)}/insights`),
    SharedContextResponseSchema
  );
}
