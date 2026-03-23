begin;

alter table if exists public.therapist_contact_requests
  add column if not exists source text,
  add column if not exists source_article_slug text,
  add column if not exists funnel_status text default 'new',
  add column if not exists entry_intent text default 'therapy';

update public.therapist_contact_requests
set source = coalesce(nullif(source, ''), 'directory')
where source is null or trim(source) = '';

update public.therapist_contact_requests
set funnel_status = coalesce(nullif(funnel_status, ''), 'new')
where funnel_status is null or trim(funnel_status) = '';

update public.therapist_contact_requests
set entry_intent = coalesce(nullif(entry_intent, ''), 'therapy')
where entry_intent is null or trim(entry_intent) = '';

create index if not exists idx_therapist_contact_requests_source
  on public.therapist_contact_requests (source);

create index if not exists idx_therapist_contact_requests_entry_intent
  on public.therapist_contact_requests (entry_intent);

commit;
