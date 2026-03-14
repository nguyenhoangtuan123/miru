import type { Goal, JournalEntry, TherapistAssignment } from '../../services/contracts';

export type TherapyTabId = 'exercises' | 'reports' | 'therapist';

export type PairingRecord = Record<string, unknown> | null;
export type AppointmentRow = Record<string, unknown>;
export type MessageRow = Record<string, unknown>;

export type GoalsQueryData = {
  success: boolean;
  goals: Goal[];
};

export type JournalQueryData = {
  success: boolean;
  entries: JournalEntry[];
};

export type PairingQueryData = {
  success: boolean;
  pairing?: PairingRecord | null;
  error?: string;
};

export type ClientAssignmentsQueryData = {
  success: boolean;
  assignments: TherapistAssignment[];
  error?: string;
};

export type ClientAppointmentsQueryData = {
  success: boolean;
  appointments: AppointmentRow[];
  error?: string;
};

export type ClientMessagesQueryData = {
  success: boolean;
  messages: MessageRow[];
  error?: string;
};
