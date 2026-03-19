import {
  getMyTherapistBillingProfile,
  type TherapistBillingProfileForm,
  type TherapistPublicProfileDetail,
  type TherapistPublicProfileForm,
} from '../../../services/profiles';

export function toProfileForm(
  profile: TherapistPublicProfileDetail
): TherapistPublicProfileForm {
  return {
    display_name: profile.display_name ?? '',
    headline: profile.headline ?? '',
    bio: profile.bio ?? '',
    specializations: profile.specializations ?? [],
    contact_phone: profile.contact_phone ?? '',
    contact_email: profile.contact_email ?? '',
    contact_zalo_url: profile.contact_zalo_url ?? '',
    contact_facebook_url: profile.contact_facebook_url ?? '',
    contact_website_url: profile.contact_website_url ?? '',
    is_public: Boolean(profile.is_public),
    accepting_new_clients: Boolean(profile.accepting_new_clients),
    service_mode: profile.service_mode ?? 'both',
    starting_price_vnd: profile.starting_price_vnd ?? null,
    pricing_unit: profile.pricing_unit ?? 'session',
    pricing_note: profile.pricing_note ?? '',
    public_payment_note: profile.public_payment_note ?? '',
    public_workflow_steps: profile.public_workflow_steps ?? [],
  };
}

export function toBillingForm(
  profile:
    | Awaited<ReturnType<typeof getMyTherapistBillingProfile>>['profile']
    | null
    | undefined
): TherapistBillingProfileForm {
  return {
    payment_mode: profile?.payment_mode ?? 'manual',
    bank_account_name: profile?.bank_account_name ?? '',
    bank_name: profile?.bank_name ?? '',
    bank_account_number: profile?.bank_account_number ?? '',
    momo_phone: profile?.momo_phone ?? '',
    transfer_note: profile?.transfer_note ?? '',
  };
}

export function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}
