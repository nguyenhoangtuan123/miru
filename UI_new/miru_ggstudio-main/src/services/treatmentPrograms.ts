import { z } from 'zod';
import { api, parseApi } from './api';

export const TreatmentProgramSchema = z
  .object({
    id: z.number(),
    client_id: z.string(),
    therapist_id: z.string(),
    title: z.string().nullable().optional(),
    status: z.enum(['draft', 'published', 'archived']),
    approaches: z.array(z.string()).default([]),
    summary: z.string().nullable().optional(),
    total_sessions: z.number().nullable().optional(),
    start_date: z.string().nullable().optional(),
    review_date: z.string().nullable().optional(),
    published_at: z.string().nullable().optional(),
    archived_at: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const TreatmentGoalSchema = z
  .object({
    id: z.number(),
    program_id: z.number(),
    title: z.string(),
    description: z.string().nullable().optional(),
    success_criteria: z.string().nullable().optional(),
    status: z.enum(['not_started', 'in_progress', 'achieved', 'paused']),
    order_index: z.number().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const TreatmentSessionPlanSchema = z
  .object({
    id: z.number(),
    program_id: z.number(),
    session_number: z.number(),
    title: z.string().nullable().optional(),
    objectives: z.string().nullable().optional(),
    interventions: z.string().nullable().optional(),
    homework_plan: z.string().nullable().optional(),
    status: z.enum(['planned', 'completed', 'skipped']),
    scheduled_for: z.string().nullable().optional(),
    appointment_id: z.number().nullable().optional(),
    session_note_id: z.number().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const TreatmentProgramLookupAppointmentSchema = z
  .object({
    id: z.number(),
    appointment_date: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .passthrough();

export const TreatmentProgramLookupSessionNoteSchema = z
  .object({
    id: z.number(),
    session_date: z.string().nullable().optional(),
    session_type: z.string().nullable().optional(),
    progress_assessment: z.string().nullable().optional(),
    next_session_plan: z.string().nullable().optional(),
  })
  .passthrough();

export const TreatmentProgramDetailResponseSchema = z
  .object({
    success: z.boolean(),
    program: TreatmentProgramSchema.nullable().optional(),
    goals: z.array(TreatmentGoalSchema).default([]),
    sessions: z.array(TreatmentSessionPlanSchema).default([]),
    is_published: z.boolean(),
    client_can_view: z.boolean(),
    cache_expires_at: z.string().nullable().optional(),
    available_appointments: z.array(TreatmentProgramLookupAppointmentSchema).default([]).optional(),
    available_session_notes: z.array(TreatmentProgramLookupSessionNoteSchema).default([]).optional(),
  })
  .passthrough();

export const TreatmentGoalMutationResponseSchema = z.object({
  success: z.boolean(),
  goal: TreatmentGoalSchema.optional(),
});

export const TreatmentSessionMutationResponseSchema = z.object({
  success: z.boolean(),
  session: TreatmentSessionPlanSchema.optional(),
});

export const TreatmentProgramArchiveResponseSchema = z.object({
  success: z.boolean(),
});

export type TreatmentProgram = z.infer<typeof TreatmentProgramSchema>;
export type TreatmentGoal = z.infer<typeof TreatmentGoalSchema>;
export type TreatmentSessionPlan = z.infer<typeof TreatmentSessionPlanSchema>;
export type TreatmentProgramDetailResponse = z.infer<typeof TreatmentProgramDetailResponseSchema>;

export async function getTherapistTreatmentProgram(clientId: string) {
  return parseApi(
    api.get(`/api/treatment-programs/clients/${encodeURIComponent(clientId)}`),
    TreatmentProgramDetailResponseSchema
  );
}

export async function upsertTherapistTreatmentProgram(
  clientId: string,
  payload: {
    title?: string | null;
    approaches?: string[];
    summary?: string | null;
    total_sessions?: number | null;
    start_date?: string | null;
    review_date?: string | null;
  }
) {
  return parseApi(
    api.put(`/api/treatment-programs/clients/${encodeURIComponent(clientId)}`, payload),
    TreatmentProgramDetailResponseSchema
  );
}

export async function createTreatmentGoal(
  programId: number,
  payload: {
    title: string;
    description?: string | null;
    success_criteria?: string | null;
    status?: string | null;
    order_index?: number | null;
  }
) {
  return parseApi(api.post(`/api/treatment-programs/${programId}/goals`, payload), TreatmentGoalMutationResponseSchema);
}

export async function updateTreatmentGoal(
  programId: number,
  goalId: number,
  payload: Partial<{
    title: string;
    description: string | null;
    success_criteria: string | null;
    status: string | null;
    order_index: number | null;
  }>
) {
  return parseApi(
    api.put(`/api/treatment-programs/${programId}/goals/${goalId}`, payload),
    TreatmentGoalMutationResponseSchema
  );
}

export async function deleteTreatmentGoal(programId: number, goalId: number) {
  return parseApi(
    api.delete(`/api/treatment-programs/${programId}/goals/${goalId}`),
    TreatmentProgramArchiveResponseSchema
  );
}

export async function createTreatmentSession(
  programId: number,
  payload: {
    session_number?: number | null;
    title?: string | null;
    objectives?: string | null;
    interventions?: string | null;
    homework_plan?: string | null;
    status?: string | null;
    scheduled_for?: string | null;
    appointment_id?: number | null;
    session_note_id?: number | null;
  }
) {
  return parseApi(
    api.post(`/api/treatment-programs/${programId}/sessions`, payload),
    TreatmentSessionMutationResponseSchema
  );
}

export async function updateTreatmentSession(
  programId: number,
  sessionPlanId: number,
  payload: Partial<{
    session_number: number | null;
    title: string | null;
    objectives: string | null;
    interventions: string | null;
    homework_plan: string | null;
    status: string | null;
    scheduled_for: string | null;
    appointment_id: number | null;
    session_note_id: number | null;
  }>
) {
  return parseApi(
    api.put(`/api/treatment-programs/${programId}/sessions/${sessionPlanId}`, payload),
    TreatmentSessionMutationResponseSchema
  );
}

export async function deleteTreatmentSession(programId: number, sessionPlanId: number) {
  return parseApi(
    api.delete(`/api/treatment-programs/${programId}/sessions/${sessionPlanId}`),
    TreatmentProgramArchiveResponseSchema
  );
}

export async function publishTreatmentProgram(programId: number) {
  return parseApi(api.post(`/api/treatment-programs/${programId}/publish`), TreatmentProgramDetailResponseSchema);
}

export async function archiveTreatmentProgram(programId: number) {
  return parseApi(api.post(`/api/treatment-programs/${programId}/archive`), TreatmentProgramArchiveResponseSchema);
}

export async function getMyCurrentTreatmentProgram() {
  return parseApi(api.get('/api/treatment-programs/me/current'), TreatmentProgramDetailResponseSchema);
}
