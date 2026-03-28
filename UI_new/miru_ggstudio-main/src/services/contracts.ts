import { z } from 'zod';

export const IdSchema = z.union([z.string(), z.number()]);

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
  role: z.enum(['client', 'therapist']).optional(),
  therapist_status: z.enum(['not_submitted', 'pending', 'approved', 'rejected']).nullable().optional(),
  can_access_therapist_portal: z.boolean().optional(),
  is_admin_reviewer: z.boolean().optional(),
});

export const CurrentUserResponseSchema = z.object({
  user: UserSchema.extend({
    role: z.enum(['client', 'therapist']).nullable().optional(),
    therapist_status: z.enum(['not_submitted', 'pending', 'approved', 'rejected']).nullable().optional(),
    can_access_therapist_portal: z.boolean().optional(),
    is_admin_reviewer: z.boolean().optional(),
  }),
});

export const LogoutResponseSchema = z.object({
  message: z.string(),
});

export const SetRoleResponseSchema = z.object({
  success: z.boolean(),
  role: z.enum(['client', 'therapist']),
  therapist_status: z.enum(['not_submitted', 'pending', 'approved', 'rejected']).nullable().optional(),
  can_access_therapist_portal: z.boolean().optional(),
  warning: z.string().optional(),
});

export const AppConsentSchema = z.object({
  accepted: z.boolean(),
  version: z.string(),
  accepted_at: z.string().nullable().optional(),
  items: z.object({
    terms: z.boolean(),
    privacy: z.boolean(),
    ai_support: z.boolean(),
  }),
});

export const AppConsentResponseSchema = z.object({
  success: z.boolean(),
  consent: AppConsentSchema,
});

export const ChatSessionSchema = z.object({
  id: IdSchema,
  title: z.string(),
  date: z.string().optional(),
  time: z.string().optional(),
});

export const ChatSessionsResponseSchema = z.object({
  success: z.boolean(),
  sessions: z.array(ChatSessionSchema),
  count: z.number().optional(),
  error: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  id: IdSchema.optional(),
  role: z.enum(['user', 'assistant', 'ai']),
  content: z.string(),
  created_at: z.string().optional(),
});

export const ChatMessagesResponseSchema = z.object({
  success: z.boolean(),
  messages: z.array(ChatMessageSchema),
  error: z.string().optional(),
});

export const CreatedSessionResponseSchema = z.object({
  success: z.boolean(),
  session: z
    .object({
      id: IdSchema,
      title: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

export const ChatTitleResponseSchema = z.object({
  success: z.boolean(),
  title: z.string().optional(),
  error: z.string().optional(),
});

export const CreateSessionWithMessageSchema = z.object({
  user_id: z.string(),
  message: z.string().min(1),
});

export const MemoryItemSchema = z
  .object({
    id: IdSchema.optional(),
    memory: z.string().optional(),
    content: z.string().optional(),
    created_at: z.string().optional(),
    metadata: z
      .record(z.unknown())
      .nullable()
      .optional()
      .transform((value) => value ?? {}),
  })
  .passthrough();

export const MemoryListResponseSchema = z.object({
  success: z.boolean(),
  memories: z.array(MemoryItemSchema),
  relations: z.array(z.unknown()).optional(),
});

export const MemoryGraphNodeSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    label: z.string().optional(),
  })
  .passthrough();

export const MemoryGraphEdgeSchema = z
  .object({
    from: z.union([z.string(), z.number()]),
    to: z.union([z.string(), z.number()]),
    label: z.string().optional(),
  })
  .passthrough();

export const MemoryGraphSchema = z
  .object({
    central_node: z.record(z.unknown()).nullable().optional(),
    nodes: z.array(MemoryGraphNodeSchema).default([]),
    edges: z.array(MemoryGraphEdgeSchema).default([]),
  })
  .passthrough();

export const MemoryGraphResponseSchema = z.object({
  success: z.boolean(),
  graph: MemoryGraphSchema,
});

export const MemoryPatternsResponseSchema = z.object({
  success: z.boolean(),
  patterns: z.record(z.unknown()),
});

export const TimelineItemSchema = z
  .object({
    date: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
  })
  .passthrough();

export const TimelineResponseSchema = z.object({
  success: z.boolean(),
  timeline: z.array(TimelineItemSchema).default([]),
});

export const JournalEntrySchema = z
  .object({
    id: IdSchema.optional(),
    user_id: z.string(),
    content: z.string().min(1),
    title: z.string().nullable().optional(),
    mood: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export const JournalListResponseSchema = z.object({
  success: z.boolean(),
  entries: z.array(JournalEntrySchema).default([]),
});

export const JournalSaveResponseSchema = z
  .object({
    success: z.boolean(),
    id: IdSchema.optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const GoalSchema = z
  .object({
    id: z.number().optional(),
    user_id: z.string(),
    title: z.string(),
    description: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    completed: z.boolean().optional(),
    created_at: z.string().optional(),
    completed_at: z.string().nullable().optional(),
  })
  .passthrough();

export const GoalsResponseSchema = z.object({
  success: z.boolean(),
  goals: z.array(GoalSchema).default([]),
});

export const GoalPayloadSchema = z.object({
  user_id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  due_date: z.string().optional(),
});

export const GoalUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  completed: z.boolean().optional(),
});

export const GoalMutationResponseSchema = z.object({
  success: z.boolean(),
  goal: GoalSchema.nullable().optional(),
});

export const CheckinStatusResponseSchema = z
  .object({
    success: z.boolean(),
    has_checked_in_today: z.boolean().optional(),
    streak: z.number().optional(),
    last_score: z.number().nullable().optional(),
    last_checkin_time: z.string().nullable().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const ProactiveMessageResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const DailyMoodCheckinSchema = z.object({
  user_id: z.string(),
  emotion_score: z.number().int().min(1).max(10),
  context_tags: z.array(z.string()).default([]),
  note: z.string().optional(),
});

export const DailyMoodCheckinResponseSchema = z
  .object({
    success: z.boolean(),
    streak: z.number().optional(),
    insight: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const MomentItemSchema = z.record(z.unknown());

export const MomentsResponseSchema = z
  .object({
    success: z.boolean(),
    moments: z.array(MomentItemSchema).default([]),
    count: z.number().optional(),
  })
  .passthrough();

export const SimpleSuccessResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const ConsentStatusSchema = z.object({
  consent_version: z.string(),
  accepted: z.boolean(),
  accepted_at: z.string().nullable().optional(),
  processing_consent: z.boolean().optional(),
  crisis_notice_acknowledged: z.boolean().optional(),
  allow_proactive_support: z.boolean().optional(),
});

export const ConsentStatusResponseSchema = z.object({
  success: z.boolean(),
  consent: ConsentStatusSchema,
});

export const PushConfigResponseSchema = z
  .object({
    success: z.boolean(),
    enabled: z.boolean(),
    public_key: z.string().nullable().optional(),
  })
  .passthrough();

export const TherapistInfoResponseSchema = z
  .object({
    success: z.boolean(),
    therapist: z.record(z.unknown()).optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistClientsResponseSchema = z
  .object({
    success: z.boolean(),
    clients: z.array(z.record(z.unknown())).default([]),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistAssignmentChecklistItemSchema = z
  .object({
    id: z.string(),
    label: z.string(),
  })
  .passthrough();

export const TherapistAssignmentAttachmentSchema = z
  .object({
    path: z.string(),
    name: z.string(),
    mime_type: z.string().nullable().optional(),
    size: z.number().nullable().optional(),
    uploaded_at: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough();

export const TherapistAssignmentSchema = z
  .object({
    id: IdSchema.optional(),
    therapist_id: z.string().nullable().optional(),
    client_id: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    priority: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    checklist_items: z.array(TherapistAssignmentChecklistItemSchema).default([]),
    checked_item_ids: z.array(z.string()).default([]),
    submission_attachments: z.array(TherapistAssignmentAttachmentSchema).default([]),
    completion_notes: z.string().nullable().optional(),
    completed_steps: z.number().default(0),
    total_steps: z.number().default(0),
    progress_percent: z.number().default(0),
    is_overdue: z.boolean().default(false),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    completed_at: z.string().nullable().optional(),
  })
  .passthrough();

export const TherapistAssignmentsResponseSchema = z
  .object({
    success: z.boolean(),
    assignments: z.array(TherapistAssignmentSchema).default([]),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistAssignmentMutationResponseSchema = z
  .object({
    success: z.boolean(),
    assignment: TherapistAssignmentSchema.optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistCrisesResponseSchema = z
  .object({
    success: z.boolean(),
    crises: z.array(z.record(z.unknown())).default([]),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistCrisisMutationResponseSchema = z
  .object({
    success: z.boolean(),
    crisis: z.record(z.unknown()).optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistClientSummaryResponseSchema = z
  .object({
    success: z.boolean(),
    summary: z
      .object({
        client_id: z.string().optional(),
        client: z.record(z.unknown()).optional(),
        total_sessions: z.number().optional(),
        completed_assignments: z.number().optional(),
        pending_assignments: z.number().optional(),
        pending_assessments: z.number().optional(),
        crisis_events: z.number().optional(),
        open_crisis_count: z.number().optional(),
        unread_client_messages: z.number().optional(),
        today_appointments_count: z.number().optional(),
        pending_items_count: z.number().optional(),
        attention_level: z.enum(['low', 'medium', 'high']).optional(),
        attention_reason: z.string().optional(),
        trajectory_state: z.string().optional(),
        trend_summary: z.string().optional(),
        suggested_next_action: z.string().optional(),
        trajectory_summary: z.record(z.unknown()).nullable().optional(),
        last_client_activity_at: z.string().nullable().optional(),
        last_therapist_action_at: z.string().nullable().optional(),
        next_appointment_at: z.string().nullable().optional(),
        share_access_enabled: z.boolean().optional(),
      })
      .optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistMorningBoardResponseSchema = z
  .object({
    success: z.boolean(),
    board: z
      .object({
        attention_clients: z.array(z.record(z.unknown())).default([]),
        new_contact_requests: z.array(z.record(z.unknown())).default([]),
        today_appointments: z.array(z.record(z.unknown())).default([]),
        pending_assignments: z.array(z.record(z.unknown())).default([]),
        pending_assessments: z.array(z.record(z.unknown())).default([]),
        open_crises: z.array(z.record(z.unknown())).default([]),
        stats: z
          .object({
            total_clients: z.number().optional(),
            attention_clients: z.number().optional(),
            new_contact_requests: z.number().optional(),
            today_appointments: z.number().optional(),
            pending_assignments: z.number().optional(),
            pending_assessments: z.number().optional(),
            open_crises: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistPairingSchema = z
  .object({
    id: IdSchema.optional(),
    therapist_id: z.string().optional().nullable(),
    client_id: z.string().optional().nullable(),
    pairing_code: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    paired_at: z.string().optional().nullable(),
    therapist: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const TherapistPairingResponseSchema = z
  .object({
    success: z.boolean(),
    pairing: TherapistPairingSchema.nullable().optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistMessagesResponseSchema = z
  .object({
    success: z.boolean(),
    messages: z.array(z.record(z.unknown())).default([]),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistMessageMutationResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.record(z.unknown()).optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistConversationsResponseSchema = z
  .object({
    success: z.boolean(),
    conversations: z.array(z.record(z.unknown())).default([]),
    error: z.string().optional(),
  })
  .passthrough();

export const TherapistUnreadCountResponseSchema = z
  .object({
    success: z.boolean(),
    count: z.number().default(0),
    error: z.string().optional(),
  })
  .passthrough();

export const AppointmentsResponseSchema = z
  .object({
    success: z.boolean(),
    appointments: z.array(z.record(z.unknown())).default([]),
    error: z.string().optional(),
  })
  .passthrough();

export const AppointmentMutationResponseSchema = z
  .object({
    success: z.boolean(),
    appointment: z.record(z.unknown()).optional(),
    error: z.string().optional(),
  })
  .passthrough();

export const WsChatRequestSchema = z
  .object({
    message: z.string().optional(),
    session_id: IdSchema.optional(),
    images: z
      .array(
        z.object({
          base64: z.string(),
          mime_type: z.string(),
        })
      )
      .optional(),
  })
  .refine(
    (value) => Boolean(value.message?.trim() || value.images?.length),
    'message or images is required'
  );

export const ArticleSuggestionSchema = z.object({
  id: IdSchema.nullable().optional(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().nullable().optional(),
  cover_image_url: z.string().nullable().optional(),
  therapist_name: z.string().nullable().optional(),
  topic_tags: z.array(z.string()).default([]),
  reason_text: z.string().nullable().optional(),
});

export const WsAiResponseSchema = z.object({
  type: z.literal('ai_response'),
  message: z.string(),
  crisis_level: z.string().nullable().optional(),
  timestamp: z.string(),
  article_suggestions: z.array(ArticleSuggestionSchema).optional(),
});

export const WsThinkingSchema = z.object({
  type: z.literal('thinking'),
  message: z.string(),
  timestamp: z.string(),
});

export const WsAiChunkSchema = z.object({
  type: z.literal('ai_chunk'),
  chunk: z.string(),
  index: z.number().int().nonnegative(),
  timestamp: z.string(),
});

export const WsSaveErrorSchema = z.object({
  type: z.literal('save_error'),
  message: z.string(),
});

export const WsErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});

export const WsServerEventSchema = z.discriminatedUnion('type', [
  WsAiResponseSchema,
  WsThinkingSchema,
  WsAiChunkSchema,
  WsSaveErrorSchema,
  WsErrorSchema,
]);

export type ChatSession = z.infer<typeof ChatSessionSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type Goal = z.infer<typeof GoalSchema>;
export type TimelineItem = z.infer<typeof TimelineItemSchema>;
export type MomentItem = z.infer<typeof MomentItemSchema>;
export type ConsentStatus = z.infer<typeof ConsentStatusSchema>;
export type TherapistAssignment = z.infer<typeof TherapistAssignmentSchema>;
export type TherapistAssignmentChecklistItem = z.infer<typeof TherapistAssignmentChecklistItemSchema>;
export type TherapistAssignmentAttachment = z.infer<typeof TherapistAssignmentAttachmentSchema>;
export type TherapistClientSummary = z.infer<typeof TherapistClientSummaryResponseSchema>['summary'];
export type TherapistMorningBoard = z.infer<typeof TherapistMorningBoardResponseSchema>['board'];
export type ArticleSuggestion = z.infer<typeof ArticleSuggestionSchema>;
export type WsServerEvent = z.infer<typeof WsServerEventSchema>;
