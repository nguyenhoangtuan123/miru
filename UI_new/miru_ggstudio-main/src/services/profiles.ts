import { z } from 'zod';
import { api, parseApi } from './api';

export const ProfileImageAssetSchema = z
  .object({
    id: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    mime_type: z.string().nullable().optional(),
    size: z.number().nullable().optional(),
    uploaded_at: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
  })
  .passthrough();

export const TherapistPublicProfileSchema = z
  .object({
    therapist_id: z.string(),
    display_name: z.string(),
    headline: z.string().nullable().optional(),
    bio: z.string().nullable().optional(),
    specializations: z.array(z.string()).default([]),
    contact_phone: z.string().nullable().optional(),
    contact_email: z.string().nullable().optional(),
    contact_zalo_url: z.string().nullable().optional(),
    contact_facebook_url: z.string().nullable().optional(),
    contact_website_url: z.string().nullable().optional(),
    avatar_image: ProfileImageAssetSchema.nullable().optional(),
    certificate_images: z.array(ProfileImageAssetSchema).default([]),
    is_public: z.boolean().default(false),
    accepting_new_clients: z.boolean().default(true),
    service_mode: z.enum(['free', 'paid', 'both']).default('both'),
    starting_price_vnd: z.preprocess((value) => {
      if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return value ?? null;
    }, z.number().nullable()),
    pricing_unit: z.enum(['session', 'package', 'custom']).default('session'),
    pricing_note: z.string().nullable().optional(),
    public_payment_note: z.string().nullable().optional(),
    public_workflow_steps: z.array(z.string()).nullish().transform((value) => value ?? []),
    profile_view_count: z.number().default(0),
    contact_request_count: z.number().default(0),
    pair_conversion_count: z.number().default(0),
    can_receive_contact_requests: z.boolean().default(false),
    is_verified: z.boolean().default(false),
    verification_status: z
      .enum(['not_submitted', 'pending', 'approved', 'rejected'])
      .nullable()
      .optional(),
    account_email: z.string().nullable().optional(),
    therapist_name: z.string().nullable().optional(),
  })
  .passthrough();

export const ClientPrivateProfileSchema = z
  .object({
    user_id: z.string(),
    display_name: z.string(),
    email: z.string().nullable().optional(),
    intro: z.string().default(''),
    avatar_image: ProfileImageAssetSchema.nullable().optional(),
    gallery_images: z.array(ProfileImageAssetSchema).default([]),
  })
  .passthrough();

export const TherapistPublicProfilesResponseSchema = z.object({
  success: z.boolean(),
  therapists: z.array(TherapistPublicProfileSchema).default([]),
});

export const TherapistPublicProfileResponseSchema = z.object({
  success: z.boolean(),
  profile: TherapistPublicProfileSchema,
});

export const ClientPrivateProfileResponseSchema = z.object({
  success: z.boolean(),
  profile: ClientPrivateProfileSchema,
});

export const TherapistPublicProfileFormSchema = z.object({
  display_name: z.string().trim().max(120),
  headline: z.string().trim().max(160).optional().default(''),
  bio: z.string().trim().max(3000).optional().default(''),
  specializations: z.array(z.string().trim().min(1)).max(12).default([]),
  contact_phone: z.string().trim().max(60).optional().default(''),
  contact_email: z.string().trim().max(160).optional().default(''),
  contact_zalo_url: z.string().trim().max(300).optional().default(''),
  contact_facebook_url: z.string().trim().max(300).optional().default(''),
  contact_website_url: z.string().trim().max(300).optional().default(''),
  is_public: z.boolean().default(false),
  accepting_new_clients: z.boolean().default(true),
  service_mode: z.enum(['free', 'paid', 'both']).default('both'),
  starting_price_vnd: z.number().nullable().optional(),
  pricing_unit: z.enum(['session', 'package', 'custom']).default('session'),
  pricing_note: z.string().trim().max(600).optional().default(''),
  public_payment_note: z.string().trim().max(600).optional().default(''),
  public_workflow_steps: z.array(z.string().trim().min(1).max(160)).max(5).default([]),
});

export const ClientPrivateProfileFormSchema = z.object({
  intro: z.string().trim().max(2000).optional().default(''),
});

export const TherapistBillingProfileSchema = z
  .object({
    therapist_id: z.string(),
    payment_mode: z.string().nullish().transform((value) => value ?? 'manual'),
    bank_account_name: z.string().nullish().transform((value) => value ?? ''),
    bank_name: z.string().nullish().transform((value) => value ?? ''),
    bank_account_number: z.string().nullish().transform((value) => value ?? ''),
    momo_phone: z.string().nullish().transform((value) => value ?? ''),
    transfer_note: z.string().nullish().transform((value) => value ?? ''),
    updated_at: z.string().nullable().optional(),
  })
  .passthrough();

export const TherapistBillingProfileResponseSchema = z.object({
  success: z.boolean(),
  profile: TherapistBillingProfileSchema,
});

export const TherapistBillingProfileFormSchema = z.object({
  payment_mode: z.string().trim().max(40).optional().default('manual'),
  bank_account_name: z.string().trim().max(120).optional().default(''),
  bank_name: z.string().trim().max(120).optional().default(''),
  bank_account_number: z.string().trim().max(60).optional().default(''),
  momo_phone: z.string().trim().max(40).optional().default(''),
  transfer_note: z.string().trim().max(240).optional().default(''),
});

export const TherapistContactRequestSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    therapist_id: z.string(),
    client_id: z.string(),
    status: z.enum(['pending', 'approved', 'declined', 'archived']).default('pending'),
    funnel_status: z.enum(['new', 'replied', 'approved', 'paired', 'lost']).default('new'),
    source: z.enum(['directory', 'profile_direct_link', 'therapist_invite', 'referral', 'article']).default('directory'),
    source_article_slug: z.string().nullable().optional(),
    entry_intent: z.enum(['message', 'therapy']).default('therapy'),
    message: z.string().default(''),
    preferred_contact_method: z.string().nullable().optional(),
    client_contact_phone: z.string().nullable().optional(),
    client_contact_zalo: z.string().nullable().optional(),
    service_interest: z.string().default('unsure'),
    therapist_reply: z.string().nullable().optional(),
    shared_pairing_code: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    handled_at: z.string().nullable().optional(),
    paired_at: z.string().nullable().optional(),
    response_time_hours: z.number().nullable().optional(),
    therapist: TherapistPublicProfileSchema.nullable().optional(),
    client: z
      .object({
        id: z.string(),
        name: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        picture: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const TherapistContactRequestsResponseSchema = z.object({
  success: z.boolean(),
  requests: z.array(TherapistContactRequestSchema).default([]),
});

export const TherapistContactRequestResponseSchema = z.object({
  success: z.boolean(),
  request: TherapistContactRequestSchema,
});

export const TherapistContactRequestCreateSchema = z.object({
  therapist_id: z.string(),
  message: z.string().trim().max(1200).optional().default(''),
  preferred_contact_method: z.string().trim().max(40).optional().default(''),
  client_contact_phone: z.string().trim().max(40).optional().default(''),
  client_contact_zalo: z.string().trim().max(120).optional().default(''),
  service_interest: z.enum(['free', 'paid', 'unsure']).optional().default('unsure'),
  source: z.enum(['directory', 'profile_direct_link', 'therapist_invite', 'referral', 'article']).optional().default('directory'),
  source_article_slug: z.string().trim().max(240).optional().default(''),
  entry_intent: z.enum(['message', 'therapy']).optional().default('therapy'),
});

export const TherapistContactRequestHandleSchema = z.object({
  therapist_reply: z.string().trim().max(1200).optional().default(''),
  share_pairing_code: z.boolean().default(false),
});

export type ProfileImageAsset = {
  id?: string | null;
  name?: string | null;
  mime_type?: string | null;
  size?: number | null;
  uploaded_at?: string | null;
  url?: string | null;
  source?: string | null;
};

export type TherapistPublicProfileCard = {
  therapist_id: string;
  display_name: string;
  headline?: string | null;
  bio?: string | null;
  specializations: string[];
  contact_phone?: string | null;
  contact_email?: string | null;
  contact_zalo_url?: string | null;
  contact_facebook_url?: string | null;
  contact_website_url?: string | null;
  avatar_image?: ProfileImageAsset | null;
  certificate_images: ProfileImageAsset[];
  is_public: boolean;
  accepting_new_clients: boolean;
  service_mode: 'free' | 'paid' | 'both';
  starting_price_vnd?: number | null;
  pricing_unit: 'session' | 'package' | 'custom';
  pricing_note?: string | null;
  public_payment_note?: string | null;
  public_workflow_steps: string[];
  profile_view_count: number;
  contact_request_count: number;
  pair_conversion_count: number;
  can_receive_contact_requests: boolean;
  is_verified: boolean;
  verification_status?: 'not_submitted' | 'pending' | 'approved' | 'rejected' | null;
  account_email?: string | null;
  therapist_name?: string | null;
};

export type TherapistPublicProfileDetail = TherapistPublicProfileCard;

export type TherapistPublicProfileForm = {
  display_name: string;
  headline: string;
  bio: string;
  specializations: string[];
  contact_phone: string;
  contact_email: string;
  contact_zalo_url: string;
  contact_facebook_url: string;
  contact_website_url: string;
  is_public: boolean;
  accepting_new_clients: boolean;
  service_mode: 'free' | 'paid' | 'both';
  starting_price_vnd?: number | null;
  pricing_unit: 'session' | 'package' | 'custom';
  pricing_note: string;
  public_payment_note: string;
  public_workflow_steps: string[];
};

export type ClientPrivateProfile = {
  user_id: string;
  display_name: string;
  email?: string | null;
  intro: string;
  avatar_image?: ProfileImageAsset | null;
  gallery_images: ProfileImageAsset[];
};

export type ClientPrivateProfileForm = {
  intro: string;
};

export type TherapistBillingProfile = {
  therapist_id: string;
  payment_mode: string;
  bank_account_name: string;
  bank_name: string;
  bank_account_number: string;
  momo_phone: string;
  transfer_note: string;
  updated_at?: string | null;
};

export type TherapistBillingProfileForm = {
  payment_mode: string;
  bank_account_name: string;
  bank_name: string;
  bank_account_number: string;
  momo_phone: string;
  transfer_note: string;
};

export type TherapistContactRequest = {
  id: number | string;
  therapist_id: string;
  client_id: string;
  status: 'pending' | 'approved' | 'declined' | 'archived';
  funnel_status: 'new' | 'replied' | 'approved' | 'paired' | 'lost';
  source: 'directory' | 'profile_direct_link' | 'therapist_invite' | 'referral' | 'article';
  source_article_slug?: string | null;
  entry_intent: 'message' | 'therapy';
  message: string;
  preferred_contact_method?: string | null;
  client_contact_phone?: string | null;
  client_contact_zalo?: string | null;
  service_interest: string;
  therapist_reply?: string | null;
  shared_pairing_code?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  handled_at?: string | null;
  paired_at?: string | null;
  response_time_hours?: number | null;
  therapist?: TherapistPublicProfileCard | null;
  client?: {
    id: string;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
  } | null;
};

export type TherapistContactRequestCreate = {
  therapist_id: string;
  message: string;
  preferred_contact_method: string;
  client_contact_phone: string;
  client_contact_zalo: string;
  service_interest: 'free' | 'paid' | 'unsure';
  source?: 'directory' | 'profile_direct_link' | 'therapist_invite' | 'referral' | 'article';
  source_article_slug?: string;
  entry_intent?: 'message' | 'therapy';
};

export type TherapistContactRequestHandle = {
  therapist_reply: string;
  share_pairing_code: boolean;
};

export async function getPublicTherapists(limit?: number) {
  return parseApi(
    api.get('/api/profiles/therapists/public', {
      params: typeof limit === 'number' ? { limit } : undefined,
    }),
    TherapistPublicProfilesResponseSchema
  );
}

export async function getPublicTherapist(therapistId: string) {
  return parseApi(
    api.get(`/api/profiles/therapists/public/${therapistId}`),
    TherapistPublicProfileResponseSchema
  );
}

export async function createTherapistContactRequest(payload: TherapistContactRequestCreate) {
  return parseApi(
    api.post('/api/therapist-contact-requests', TherapistContactRequestCreateSchema.parse(payload)),
    TherapistContactRequestResponseSchema
  );
}

export async function getMyTherapistContactRequests() {
  return parseApi(
    api.get('/api/therapist-contact-requests/me'),
    TherapistContactRequestsResponseSchema
  );
}

export async function getMyTherapistProfile() {
  return parseApi(api.get('/api/profiles/me/therapist'), TherapistPublicProfileResponseSchema);
}

export async function updateMyTherapistProfile(payload: TherapistPublicProfileForm) {
  return parseApi(
    api.put('/api/profiles/me/therapist', TherapistPublicProfileFormSchema.parse(payload)),
    TherapistPublicProfileResponseSchema
  );
}

export async function getMyTherapistBillingProfile() {
  return parseApi(
    api.get('/api/profiles/me/therapist/billing'),
    TherapistBillingProfileResponseSchema
  );
}

export async function updateMyTherapistBillingProfile(payload: TherapistBillingProfileForm) {
  return parseApi(
    api.put('/api/profiles/me/therapist/billing', TherapistBillingProfileFormSchema.parse(payload)),
    TherapistBillingProfileResponseSchema
  );
}

export async function uploadMyTherapistAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return parseApi(
    api.post('/api/profiles/me/therapist/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    TherapistPublicProfileResponseSchema
  );
}

export async function uploadMyTherapistCertificates(files: File[]) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  return parseApi(
    api.post('/api/profiles/me/therapist/certificates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    TherapistPublicProfileResponseSchema
  );
}

export async function deleteMyTherapistMedia(mediaId: string) {
  return parseApi(
    api.delete(`/api/profiles/me/therapist/media/${encodeURIComponent(mediaId)}`),
    TherapistPublicProfileResponseSchema
  );
}

export async function getMyClientProfile() {
  return parseApi(api.get('/api/profiles/me/client'), ClientPrivateProfileResponseSchema);
}

export async function updateMyClientProfile(payload: ClientPrivateProfileForm) {
  return parseApi(
    api.put('/api/profiles/me/client', ClientPrivateProfileFormSchema.parse(payload)),
    ClientPrivateProfileResponseSchema
  );
}

export async function uploadMyClientAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return parseApi(
    api.post('/api/profiles/me/client/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    ClientPrivateProfileResponseSchema
  );
}

export async function uploadMyClientGallery(files: File[]) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  return parseApi(
    api.post('/api/profiles/me/client/gallery', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    ClientPrivateProfileResponseSchema
  );
}

export async function deleteMyClientMedia(mediaId: string) {
  return parseApi(
    api.delete(`/api/profiles/me/client/media/${encodeURIComponent(mediaId)}`),
    ClientPrivateProfileResponseSchema
  );
}

export async function getTherapistViewOfClientProfile(clientId: string) {
  return parseApi(
    api.get(`/api/profiles/clients/${clientId}`),
    ClientPrivateProfileResponseSchema
  );
}

export async function getTherapistContactRequests(status?: string) {
  return parseApi(
    api.get('/api/therapist/contact-requests', {
      params: status ? { status } : undefined,
    }),
    TherapistContactRequestsResponseSchema
  );
}

export async function getTherapistContactRequestDetail(requestId: string | number) {
  return parseApi(
    api.get(`/api/therapist/contact-requests/${requestId}`),
    TherapistContactRequestResponseSchema
  );
}

export async function approveTherapistContactRequest(
  requestId: string | number,
  payload: TherapistContactRequestHandle
) {
  return parseApi(
    api.post(
      `/api/therapist/contact-requests/${requestId}/approve`,
      TherapistContactRequestHandleSchema.parse(payload)
    ),
    TherapistContactRequestResponseSchema
  );
}

export async function declineTherapistContactRequest(
  requestId: string | number,
  payload: TherapistContactRequestHandle
) {
  return parseApi(
    api.post(
      `/api/therapist/contact-requests/${requestId}/decline`,
      TherapistContactRequestHandleSchema.parse(payload)
    ),
    TherapistContactRequestResponseSchema
  );
}

export async function archiveTherapistContactRequest(requestId: string | number) {
  return parseApi(
    api.post(`/api/therapist/contact-requests/${requestId}/archive`),
    TherapistContactRequestResponseSchema
  );
}
