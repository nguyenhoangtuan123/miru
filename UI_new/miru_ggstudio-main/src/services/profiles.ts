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
    is_verified: z.boolean().default(false),
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
});

export const ClientPrivateProfileFormSchema = z.object({
  intro: z.string().trim().max(2000).optional().default(''),
});

export type ProfileImageAsset = z.infer<typeof ProfileImageAssetSchema>;
export type TherapistPublicProfileCard = z.infer<typeof TherapistPublicProfileSchema>;
export type TherapistPublicProfileDetail = z.infer<typeof TherapistPublicProfileSchema>;
export type TherapistPublicProfileForm = z.infer<typeof TherapistPublicProfileFormSchema>;
export type ClientPrivateProfile = z.infer<typeof ClientPrivateProfileSchema>;
export type ClientPrivateProfileForm = z.infer<typeof ClientPrivateProfileFormSchema>;

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

export async function getMyTherapistProfile() {
  return parseApi(api.get('/api/profiles/me/therapist'), TherapistPublicProfileResponseSchema);
}

export async function updateMyTherapistProfile(payload: TherapistPublicProfileForm) {
  return parseApi(
    api.put('/api/profiles/me/therapist', TherapistPublicProfileFormSchema.parse(payload)),
    TherapistPublicProfileResponseSchema
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
