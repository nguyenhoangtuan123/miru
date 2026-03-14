begin;

alter table if exists public.therapist_public_profiles
  add column if not exists accepting_new_clients boolean default true,
  add column if not exists service_mode text default 'both',
  add column if not exists starting_price_vnd bigint,
  add column if not exists pricing_unit text default 'session',
  add column if not exists pricing_note text,
  add column if not exists public_payment_note text,
  add column if not exists public_workflow_steps jsonb default '[]'::jsonb;

create table if not exists public.therapist_billing_profiles (
  therapist_id text primary key,
  payment_mode text default 'manual',
  bank_account_name text,
  bank_name text,
  bank_account_number text,
  momo_phone text,
  transfer_note text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.therapist_contact_requests (
  id bigserial primary key,
  therapist_id text not null,
  client_id text not null,
  status text not null default 'pending',
  message text,
  preferred_contact_method text,
  client_contact_phone text,
  client_contact_zalo text,
  service_interest text default 'unsure',
  therapist_reply text,
  shared_pairing_code text,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now()),
  handled_at timestamptz
);

create index if not exists idx_therapist_contact_requests_therapist_id
  on public.therapist_contact_requests (therapist_id);

create index if not exists idx_therapist_contact_requests_client_id
  on public.therapist_contact_requests (client_id);

create index if not exists idx_therapist_contact_requests_status
  on public.therapist_contact_requests (status);

commit;
