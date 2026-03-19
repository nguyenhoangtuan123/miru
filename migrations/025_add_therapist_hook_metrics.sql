begin;

alter table if exists public.therapist_public_profiles
  add column if not exists profile_view_count bigint not null default 0,
  add column if not exists contact_request_count bigint not null default 0,
  add column if not exists pair_conversion_count bigint not null default 0;

alter table if exists public.therapist_contact_requests
  add column if not exists source text default 'directory',
  add column if not exists funnel_status text default 'new',
  add column if not exists paired_at timestamptz;

update public.therapist_contact_requests
set source = 'directory'
where coalesce(source, '') = '';

update public.therapist_contact_requests
set funnel_status = case
  when lower(coalesce(status, 'pending')) = 'approved' then 'approved'
  when lower(coalesce(status, 'pending')) = 'declined' then 'lost'
  when lower(coalesce(status, 'pending')) = 'archived' then 'lost'
  else 'new'
end
where coalesce(funnel_status, '') = '';

commit;

do $$
begin
  if to_regclass('public.therapist_contact_requests') is not null then
    execute 'create index if not exists idx_therapist_contact_requests_funnel_status on public.therapist_contact_requests (therapist_id, funnel_status)';
    execute 'create index if not exists idx_therapist_contact_requests_source on public.therapist_contact_requests (source)';
  end if;
end $$;
