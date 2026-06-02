create extension if not exists pgcrypto;

create table if not exists public.account_groups (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    color text not null default '#22d3ee',
    group_type text not null default 'manager',
    parent_id uuid null references public.account_groups(id) on delete set null,
    note text null,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.account_groups add column if not exists color text not null default '#22d3ee';
alter table public.account_groups add column if not exists group_type text not null default 'manager';
alter table public.account_groups add column if not exists parent_id uuid null;
alter table public.account_groups add column if not exists note text null;
alter table public.account_groups add column if not exists sort_order integer not null default 0;
alter table public.account_groups add column if not exists is_active boolean not null default true;
alter table public.account_groups add column if not exists updated_at timestamptz not null default now();

do language plpgsql $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'account_groups_group_type_check'
          and conrelid = 'public.account_groups'::regclass
    ) then
        alter table public.account_groups
            add constraint account_groups_group_type_check
            check (group_type in ('folder', 'manager'));
    end if;
end $$;

do language plpgsql $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'account_groups_parent_id_fkey'
          and conrelid = 'public.account_groups'::regclass
    ) then
        alter table public.account_groups
            add constraint account_groups_parent_id_fkey
            foreign key (parent_id) references public.account_groups(id) on delete set null;
    end if;
end $$;

create table if not exists public.account_group_members (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.account_groups(id) on delete cascade,
    platform text not null default 'tiktok',
    account_id uuid not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

alter table public.account_group_members add column if not exists platform text not null default 'tiktok';
alter table public.account_group_members add column if not exists sort_order integer not null default 0;

alter table public.account_group_members
    drop constraint if exists account_group_members_account_id_fkey;

do language plpgsql $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'account_group_members_platform_check'
          and conrelid = 'public.account_group_members'::regclass
    ) then
        alter table public.account_group_members
            add constraint account_group_members_platform_check
            check (platform in ('tiktok', 'instagram'));
    end if;
end $$;

do language plpgsql $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'account_group_members_platform_account_unique'
          and conrelid = 'public.account_group_members'::regclass
    ) then
        alter table public.account_group_members
            add constraint account_group_members_platform_account_unique
            unique (platform, account_id);
    end if;
end $$;

create table if not exists public.account_notes (
    id uuid primary key default gen_random_uuid(),
    platform text not null,
    account_id uuid not null,
    note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint account_notes_platform_check check (platform in ('tiktok', 'instagram')),
    constraint account_notes_platform_account_unique unique (platform, account_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_account_groups_updated_at on public.account_groups;
create trigger set_account_groups_updated_at
before update on public.account_groups
for each row execute function public.set_updated_at();

drop trigger if exists set_account_notes_updated_at on public.account_notes;
create trigger set_account_notes_updated_at
before update on public.account_notes
for each row execute function public.set_updated_at();

alter table public.account_groups enable row level security;
alter table public.account_group_members enable row level security;
alter table public.account_notes enable row level security;

drop policy if exists "account_groups_read" on public.account_groups;
create policy "account_groups_read"
on public.account_groups for select
to anon, authenticated
using (true);

drop policy if exists "account_group_members_read" on public.account_group_members;
create policy "account_group_members_read"
on public.account_group_members for select
to anon, authenticated
using (true);

drop policy if exists "account_notes_read" on public.account_notes;
create policy "account_notes_read"
on public.account_notes for select
to anon, authenticated
using (true);

grant select on public.account_groups to anon, authenticated;
grant select on public.account_group_members to anon, authenticated;
grant select on public.account_notes to anon, authenticated;
grant all on public.account_groups to service_role;
grant all on public.account_group_members to service_role;
grant all on public.account_notes to service_role;

create index if not exists account_groups_parent_sort_idx
    on public.account_groups(parent_id, sort_order);

create index if not exists account_group_members_group_sort_idx
    on public.account_group_members(group_id, sort_order);

create index if not exists account_notes_platform_account_idx
    on public.account_notes(platform, account_id);
