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

    execute format(
        'create table if not exists public.user_behavior_events (
            id bigserial primary key,
            user_id %1$s references public.users(id) on delete cascade,
            event_type text not null,
            payload jsonb not null default ''{}''::jsonb,
            occurred_at timestamptz not null default now(),
            created_at timestamptz not null default now()
        )',
        user_id_type
    );

    execute format(
        'create table if not exists public.user_trajectory_snapshots (
            id bigserial primary key,
            user_id %1$s references public.users(id) on delete cascade,
            trajectory_state text not null,
            chapter_title text not null,
            reflection_text text not null,
            suggested_next_step text not null,
            trend_summary text,
            input_summary text,
            signals jsonb not null default ''{}''::jsonb,
            created_at timestamptz not null default now(),
            version text not null default ''hook1-v1''
        )',
        user_id_type
    );

    execute format(
        'create table if not exists public.trajectory_feedback (
            id bigserial primary key,
            user_id %1$s references public.users(id) on delete cascade,
            snapshot_id bigint references public.user_trajectory_snapshots(id) on delete set null,
            feedback_type text not null,
            note text,
            created_at timestamptz not null default now()
        )',
        user_id_type
    );
end $$;

create index if not exists idx_user_behavior_events_user_time
    on public.user_behavior_events(user_id, occurred_at desc);

create index if not exists idx_user_behavior_events_type_time
    on public.user_behavior_events(event_type, occurred_at desc);

create index if not exists idx_user_trajectory_snapshots_user_time
    on public.user_trajectory_snapshots(user_id, created_at desc);

create index if not exists idx_trajectory_feedback_user_time
    on public.trajectory_feedback(user_id, created_at desc);

commit;
