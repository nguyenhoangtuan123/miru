import { z } from 'zod';
import { api, parseApi } from './api';

export const AssessmentTemplateSchema = z
  .object({
    id: z.string(),
    short_code: z.string().nullable().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
    instructions: z.string().nullable().optional(),
    question_count: z.number().nullable().optional(),
    scoring_mode: z.string().nullable().optional(),
  })
  .passthrough();

export const AssessmentResultSchema = z
  .object({
    id: z.string().optional(),
    total_score: z.number().nullable().optional(),
    severity: z.string().nullable().optional(),
    interpretation: z.string().nullable().optional(),
    subscale_scores: z.record(z.unknown()).default({}),
    completed_at: z.string().nullable().optional(),
  })
  .passthrough();

export const AssessmentAssignmentSummarySchema = z
  .object({
    id: z.string(),
    template_id: z.string(),
    template_name: z.string().nullable().optional(),
    template_short_code: z.string().nullable().optional(),
    status: z.string(),
    due_date: z.string().nullable().optional(),
    assigned_at: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional(),
    therapist_note: z.string().nullable().optional(),
    client_id: z.string().nullable().optional(),
    client_name: z.string().nullable().optional(),
    therapist_id: z.string().nullable().optional(),
    therapist_name: z.string().nullable().optional(),
    result: AssessmentResultSchema.nullable().optional(),
  })
  .passthrough();

export const AssessmentQuestionSchema = z
  .object({
    id: z.string(),
    order_index: z.number().nullable().optional(),
    key: z.string().nullable().optional(),
    prompt: z.string(),
    choices: z
      .array(
        z
          .object({
            value: z.number(),
            label: z.string(),
          })
          .passthrough()
      )
      .default([]),
    subscale: z.string().nullable().optional(),
  })
  .passthrough();

export const AssessmentAnswerSchema = z
  .object({
    question_id: z.string(),
    question_key: z.string().nullable().optional(),
    answer_value: z.number(),
    choice_label: z.string().nullable().optional(),
  })
  .passthrough();

export const AssessmentAssignmentDetailSchema = AssessmentAssignmentSummarySchema.extend({
  template: AssessmentTemplateSchema,
  questions: z.array(AssessmentQuestionSchema).default([]),
  answers: z.array(AssessmentAnswerSchema).default([]),
});

export const AssessmentTemplatesResponseSchema = z.object({
  success: z.boolean(),
  templates: z.array(AssessmentTemplateSchema).default([]),
});

export const AssessmentAssignmentsResponseSchema = z.object({
  success: z.boolean(),
  assignments: z.array(AssessmentAssignmentSummarySchema).default([]),
});

export const AssessmentAssignmentResponseSchema = z.object({
  success: z.boolean(),
  assignment: AssessmentAssignmentDetailSchema,
});

export const AssessmentAssignmentSummaryResponseSchema = z.object({
  success: z.boolean(),
  assignment: AssessmentAssignmentSummarySchema,
});

export type AssessmentTemplate = z.infer<typeof AssessmentTemplateSchema>;
export type AssessmentResult = z.infer<typeof AssessmentResultSchema>;
export type AssessmentAssignmentSummary = z.infer<typeof AssessmentAssignmentSummarySchema>;
export type AssessmentAssignmentDetail = z.infer<typeof AssessmentAssignmentDetailSchema>;

export async function getAssessmentTemplates() {
  return parseApi(api.get('/api/assessments/templates'), AssessmentTemplatesResponseSchema);
}

export async function createAssessmentAssignment(payload: {
  client_id: string;
  template_id: string;
  due_date?: string | null;
  therapist_note?: string | null;
}) {
  return parseApi(api.post('/api/assessments/assignments', payload), AssessmentAssignmentSummaryResponseSchema);
}

export async function getTherapistClientAssessments(clientId: string) {
  return parseApi(
    api.get(`/api/assessments/therapist/clients/${encodeURIComponent(clientId)}`),
    AssessmentAssignmentsResponseSchema
  );
}

export async function getTherapistAssessmentDetail(clientId: string, assignmentId: string) {
  return parseApi(
    api.get(
      `/api/assessments/therapist/clients/${encodeURIComponent(clientId)}/assignments/${encodeURIComponent(assignmentId)}`
    ),
    AssessmentAssignmentResponseSchema
  );
}

export async function getMyAssessments() {
  return parseApi(api.get('/api/assessments/my-assignments'), AssessmentAssignmentsResponseSchema);
}

export async function getMyAssessmentDetail(assignmentId: string) {
  return parseApi(
    api.get(`/api/assessments/my-assignments/${encodeURIComponent(assignmentId)}`),
    AssessmentAssignmentResponseSchema
  );
}

export async function submitMyAssessment(
  assignmentId: string,
  answers: Array<{ question_id: string; answer_value: number }>
) {
  return parseApi(
    api.post(`/api/assessments/my-assignments/${encodeURIComponent(assignmentId)}/submit`, {
      answers,
    }),
    AssessmentAssignmentResponseSchema
  );
}
