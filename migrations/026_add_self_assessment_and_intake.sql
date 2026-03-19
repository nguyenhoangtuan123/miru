begin;

do $$
declare
    user_id_type text := 'text';
begin
    select pg_catalog.format_type(a.atttypid, a.atttypmod)
    into user_id_type
    from pg_attribute as a
    join pg_class as c on c.oid = a.attrelid
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'users'
      and a.attname = 'id'
      and a.attnum > 0
      and not a.attisdropped
    limit 1;

    user_id_type := coalesce(nullif(trim(user_id_type), ''), 'text');

    if to_regclass('public.assessment_assignments') is not null then
        execute 'alter table public.assessment_assignments add column if not exists source text default ''therapist_assigned''';
        begin
            execute 'alter table public.assessment_assignments alter column therapist_id drop not null';
        exception when others then
            null;
        end;
    end if;

    if to_regclass('public.assessment_results') is not null then
        begin
            execute 'alter table public.assessment_results alter column therapist_id drop not null';
        exception when others then
            null;
        end;
    end if;

    execute format(
        'create table if not exists public.user_intake_profiles (
            user_id %1$s primary key references public.users(id) on delete cascade,
            primary_reason text,
            overwhelm_level text,
            support_style text,
            desired_help_focus text,
            wants_therapist_connection boolean not null default false,
            memory_note text,
            completed_at timestamptz,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
        )',
        user_id_type
    );
end $$;

do $$
begin
    if to_regclass('public.assessment_assignments') is not null then
        execute 'update public.assessment_assignments set source = ''therapist_assigned'' where coalesce(source, '''') = ''''';
        execute 'create index if not exists idx_assessment_assignments_source on public.assessment_assignments(source, client_id, assigned_at desc)';
    end if;
end $$;

commit;
