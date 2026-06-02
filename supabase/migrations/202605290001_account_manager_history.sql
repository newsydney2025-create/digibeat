create table if not exists public.account_manager_history (
    id uuid primary key default gen_random_uuid(),
    platform text not null,
    account_id uuid not null,
    group_id uuid null references public.account_groups(id) on delete set null,
    effective_from date not null default (now() at time zone 'Australia/Sydney')::date,
    effective_to date null,
    created_at timestamptz not null default now(),
    constraint account_manager_history_platform_check check (platform in ('tiktok', 'instagram')),
    constraint account_manager_history_date_check check (effective_to is null or effective_to >= effective_from)
);

alter table public.account_manager_history add column if not exists platform text not null default 'tiktok';
alter table public.account_manager_history add column if not exists account_id uuid not null;
alter table public.account_manager_history add column if not exists group_id uuid null;
alter table public.account_manager_history add column if not exists effective_from date not null default (now() at time zone 'Australia/Sydney')::date;
alter table public.account_manager_history add column if not exists effective_to date null;
alter table public.account_manager_history add column if not exists created_at timestamptz not null default now();

do language plpgsql $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'account_manager_history_group_id_fkey'
          and conrelid = 'public.account_manager_history'::regclass
    ) then
        alter table public.account_manager_history
            add constraint account_manager_history_group_id_fkey
            foreign key (group_id) references public.account_groups(id) on delete set null;
    end if;
end $$;

do language plpgsql $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'account_manager_history_platform_check'
          and conrelid = 'public.account_manager_history'::regclass
    ) then
        alter table public.account_manager_history
            add constraint account_manager_history_platform_check
            check (platform in ('tiktok', 'instagram'));
    end if;
end $$;

do language plpgsql $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'account_manager_history_date_check'
          and conrelid = 'public.account_manager_history'::regclass
    ) then
        alter table public.account_manager_history
            add constraint account_manager_history_date_check
            check (effective_to is null or effective_to >= effective_from);
    end if;
end $$;

insert into public.account_manager_history (platform, account_id, group_id, effective_from)
select member.platform, member.account_id, member.group_id, date '1900-01-01'
from public.account_group_members member
where not exists (
    select 1
    from public.account_manager_history history
    where history.platform = member.platform
      and history.account_id = member.account_id
);

alter table public.account_manager_history enable row level security;

drop policy if exists "account_manager_history_read" on public.account_manager_history;
create policy "account_manager_history_read"
on public.account_manager_history for select
to anon, authenticated
using (true);

grant select on public.account_manager_history to anon, authenticated;
grant all on public.account_manager_history to service_role;

create index if not exists account_manager_history_lookup_idx
    on public.account_manager_history(platform, account_id, effective_from, effective_to);

create index if not exists account_manager_history_group_idx
    on public.account_manager_history(group_id);
