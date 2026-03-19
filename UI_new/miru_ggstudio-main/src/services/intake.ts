import { z } from 'zod';
import { api, parseApi } from './api';

export const UserIntakeProfileSchema = z
  .object({
    user_id: z.string(),
    primary_reason: z.string().nullable().optional(),
    overwhelm_level: z.string().nullable().optional(),
    support_style: z.string().nullable().optional(),
    desired_help_focus: z.string().nullable().optional(),
    wants_therapist_connection: z.boolean().default(false),
    memory_note: z.string().nullable().optional(),
    completed_at: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const IntakeProfileResponseSchema = z.object({
  success: z.boolean(),
  profile: UserIntakeProfileSchema,
});

export type UserIntakeProfile = z.infer<typeof UserIntakeProfileSchema>;

export async function getMyIntakeProfile() {
  return parseApi(api.get('/api/intake/me'), IntakeProfileResponseSchema);
}

export async function updateMyIntakeProfile(payload: {
  primary_reason?: string | null;
  overwhelm_level?: string | null;
  support_style?: string | null;
  desired_help_focus?: string | null;
  wants_therapist_connection?: boolean;
  memory_note?: string | null;
}) {
  return parseApi(api.put('/api/intake/me', payload), IntakeProfileResponseSchema);
}
