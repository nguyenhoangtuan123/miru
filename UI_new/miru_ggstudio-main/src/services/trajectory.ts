import { z } from 'zod';
import { api, parseApi } from './api';

export const TrajectoryStateSchema = z.enum([
  'Giữ mọi thứ một mình',
  'Bắt đầu mở lời',
  'Quá tải gần đây',
  'Đang tìm lại nhịp ổn định',
  'Đang nhìn lại các mẫu lặp',
  'Cần thêm điểm tựa người thật',
  'Lắng nghe mình rõ hơn',
]);

export const TrajectorySummarySchema = z
  .object({
    trajectory_state: TrajectoryStateSchema.optional(),
    chapter_title: z.string(),
    reflection_text: z.string(),
    suggested_next_step: z.string(),
    trend_summary: z.string().optional(),
    updated_at: z.string().nullable().optional(),
    has_intake_profile: z.boolean().optional(),
    has_completed_self_test: z.boolean().optional(),
    previous_chapter_title: z.string().nullable().optional(),
    what_changed: z.string().nullable().optional(),
    feedback_pending: z.boolean().optional(),
    snapshot_id: z.union([z.string(), z.number()]).nullable().optional(),
    input_summary: z.string().optional(),
    signals: z.record(z.unknown()).optional(),
    version: z.string().optional(),
  })
  .passthrough();

export const TrajectorySummaryResponseSchema = z.object({
  success: z.boolean(),
  summary: TrajectorySummarySchema,
});

export const TrajectoryFeedbackPayloadSchema = z.object({
  feedback_type: z.enum([
    'not_me',
    'too_strong',
    'missing_context',
    'want_other_direction',
  ]),
  note: z.string().trim().max(1000).optional(),
});

export const TrajectoryFeedbackResponseSchema = z.object({
  success: z.boolean(),
  feedback: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      snapshot_id: z.union([z.string(), z.number()]).nullable().optional(),
      feedback_type: z.string(),
      note: z.string().nullable().optional(),
      created_at: z.string().nullable().optional(),
    })
    .passthrough(),
  summary: TrajectorySummarySchema.optional(),
});

export const TrajectoryEventPayloadSchema = z.object({
  event_type: z.enum([
    'home_opened',
    'trajectory_card_opened',
    'trajectory_feedback_submitted',
    'self_test_started',
    'self_test_completed',
    'proactive_opened',
    'therapist_directory_opened',
    'contact_request_submitted',
    'assignment_completed',
  ]),
  metadata: z.record(z.unknown()).optional(),
});

export const TrajectoryEventResponseSchema = z.object({
  success: z.boolean(),
});

export type TrajectorySummary = z.infer<typeof TrajectorySummarySchema>;
export type TrajectoryState = z.infer<typeof TrajectoryStateSchema>;
export type TrajectoryFeedbackPayload = z.infer<typeof TrajectoryFeedbackPayloadSchema>;
export type TrajectoryEventPayload = z.infer<typeof TrajectoryEventPayloadSchema>;

export async function getMyTrajectorySummary() {
  return parseApi(api.get('/api/trajectory/me/summary'), TrajectorySummaryResponseSchema);
}

export async function submitMyTrajectoryFeedback(payload: TrajectoryFeedbackPayload) {
  return parseApi(
    api.post('/api/trajectory/me/feedback', payload),
    TrajectoryFeedbackResponseSchema
  );
}

export async function trackMyTrajectoryEvent(payload: TrajectoryEventPayload) {
  return parseApi(api.post('/api/trajectory/me/events', payload), TrajectoryEventResponseSchema);
}
