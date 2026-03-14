import { z } from 'zod';
import { api, parseApi } from './api';

export const VerificationDocumentSchema = z
  .object({
    id: z.string().optional(),
    file_name: z.string().nullable().optional(),
    mime_type: z.string().nullable().optional(),
    size_bytes: z.number().nullable().optional(),
    uploaded_at: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    media_id: z.string().nullable().optional(),
  })
  .passthrough();

export const TherapistVerificationSubmissionSchema = z
  .object({
    therapist_id: z.string(),
    verification_status: z.enum(['not_submitted', 'pending', 'approved', 'rejected']),
    verification_submitted_at: z.string().nullable().optional(),
    verified_at: z.string().nullable().optional(),
    verified_by_email: z.string().nullable().optional(),
    rejection_reason: z.string().nullable().optional(),
    verification_full_name: z.string().nullable().optional(),
    verification_profession_title: z.string().nullable().optional(),
    verification_license_number: z.string().nullable().optional(),
    verification_issuing_organization: z.string().nullable().optional(),
    verification_note: z.string().nullable().optional(),
    documents: z.array(VerificationDocumentSchema).default([]),
  })
  .passthrough();

export const TherapistVerificationSubmissionResponseSchema = z.object({
  success: z.boolean(),
  submission: TherapistVerificationSubmissionSchema,
});

export const TherapistVerificationUpdateSchema = z.object({
  verification_full_name: z.string().trim().max(160).optional().default(''),
  verification_profession_title: z.string().trim().max(160).optional().default(''),
  verification_license_number: z.string().trim().max(120).optional().default(''),
  verification_issuing_organization: z.string().trim().max(200).optional().default(''),
  verification_note: z.string().trim().max(2000).optional().default(''),
});

export const AdminTherapistReviewItemSchema = z
  .object({
    therapist_id: z.string(),
    email: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    verification_status: z.enum(['not_submitted', 'pending', 'approved', 'rejected']),
    verification_submitted_at: z.string().nullable().optional(),
    verified_at: z.string().nullable().optional(),
    verified_by_email: z.string().nullable().optional(),
    rejection_reason: z.string().nullable().optional(),
    verification_full_name: z.string().nullable().optional(),
    verification_profession_title: z.string().nullable().optional(),
    verification_license_number: z.string().nullable().optional(),
    verification_issuing_organization: z.string().nullable().optional(),
    documents_count: z.number().optional().default(0),
  })
  .passthrough();

export const AdminTherapistReviewsResponseSchema = z.object({
  success: z.boolean(),
  therapists: z.array(AdminTherapistReviewItemSchema).default([]),
});

export type TherapistVerificationSubmission = z.infer<typeof TherapistVerificationSubmissionSchema>;
export type TherapistVerificationUpdate = z.infer<typeof TherapistVerificationUpdateSchema>;
export type AdminTherapistReviewItem = z.infer<typeof AdminTherapistReviewItemSchema>;

export async function getMyTherapistVerification() {
  return parseApi(
    api.get('/api/therapist-verification/me'),
    TherapistVerificationSubmissionResponseSchema
  );
}

export async function updateMyTherapistVerification(payload: TherapistVerificationUpdate) {
  return parseApi(
    api.put(
      '/api/therapist-verification/me',
      TherapistVerificationUpdateSchema.parse(payload)
    ),
    TherapistVerificationSubmissionResponseSchema
  );
}

export async function uploadTherapistVerificationDocuments(files: File[]) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  return parseApi(
    api.post('/api/therapist-verification/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    TherapistVerificationSubmissionResponseSchema
  );
}

export async function deleteTherapistVerificationDocument(mediaId: string) {
  return parseApi(
    api.delete(`/api/therapist-verification/documents/${encodeURIComponent(mediaId)}`),
    TherapistVerificationSubmissionResponseSchema
  );
}

export async function submitTherapistVerification() {
  return parseApi(
    api.post('/api/therapist-verification/submit'),
    TherapistVerificationSubmissionResponseSchema
  );
}

export async function getAdminTherapistReviews(status?: string) {
  return parseApi(
    api.get('/api/admin/therapist-verifications', {
      params: status ? { status } : undefined,
    }),
    AdminTherapistReviewsResponseSchema
  );
}

export async function getAdminTherapistReviewDetail(therapistId: string) {
  return parseApi(
    api.get(`/api/admin/therapist-verifications/${encodeURIComponent(therapistId)}`),
    TherapistVerificationSubmissionResponseSchema
  );
}

export async function approveAdminTherapistReview(therapistId: string) {
  return parseApi(
    api.post(`/api/admin/therapist-verifications/${encodeURIComponent(therapistId)}/approve`),
    TherapistVerificationSubmissionResponseSchema
  );
}

export async function rejectAdminTherapistReview(therapistId: string, rejection_reason: string) {
  return parseApi(
    api.post(`/api/admin/therapist-verifications/${encodeURIComponent(therapistId)}/reject`, {
      rejection_reason,
    }),
    TherapistVerificationSubmissionResponseSchema
  );
}
