-- Preserve updated_at for workflow-only status/review metadata changes.
-- Content and source-object changes still advance the version used by source
-- review optimistic concurrency.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'applications'
    and (to_jsonb(new) - array['status', 'updated_at']) = (to_jsonb(old) - array['status', 'updated_at']) then
    new.updated_at = old.updated_at;
  elsif tg_table_name = 'application_source_archives'
    and (to_jsonb(new) - array['review_status', 'reviewed_application_updated_at', 'reviewed_source_updated_at', 'reviewed_at', 'updated_at'])
      = (to_jsonb(old) - array['review_status', 'reviewed_application_updated_at', 'reviewed_source_updated_at', 'reviewed_at', 'updated_at']) then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create table if not exists public.filing_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applicant_address text not null default '',
  postal_code text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists filing_profiles_user_idx
  on public.filing_profiles (user_id);

drop trigger if exists filing_profiles_set_updated_at on public.filing_profiles;
create trigger filing_profiles_set_updated_at before update on public.filing_profiles
for each row execute function public.set_updated_at();

alter table public.filing_profiles enable row level security;

drop policy if exists filing_profiles_owner_select on public.filing_profiles;
drop policy if exists filing_profiles_owner_insert on public.filing_profiles;
drop policy if exists filing_profiles_owner_update on public.filing_profiles;
drop policy if exists filing_profiles_owner_delete on public.filing_profiles;

create policy filing_profiles_owner_select on public.filing_profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy filing_profiles_owner_insert on public.filing_profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy filing_profiles_owner_update on public.filing_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy filing_profiles_owner_delete on public.filing_profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.filing_profiles to authenticated;

alter table public.application_source_archives
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_application_updated_at timestamptz,
  add column if not exists reviewed_source_updated_at timestamptz,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.application_source_archives'::regclass
      and conname = 'application_source_archives_review_status_check'
  ) then
    alter table public.application_source_archives
      add constraint application_source_archives_review_status_check
      check (review_status in ('pending', 'confirmed', 'skipped'));
  end if;
end;
$$;

create index if not exists application_source_archives_review_idx
  on public.application_source_archives (application_id, review_status, updated_at desc);
