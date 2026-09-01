create table if not exists public.application_source_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  object_key text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 104857600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id)
);

create index if not exists application_source_archives_user_idx
  on public.application_source_archives (user_id, updated_at desc);

drop trigger if exists application_source_archives_set_updated_at on public.application_source_archives;
create trigger application_source_archives_set_updated_at before update on public.application_source_archives
for each row execute function public.set_updated_at();

alter table public.application_source_archives enable row level security;

drop policy if exists application_source_archives_owner_select on public.application_source_archives;
drop policy if exists application_source_archives_owner_insert on public.application_source_archives;
drop policy if exists application_source_archives_owner_update on public.application_source_archives;
drop policy if exists application_source_archives_owner_delete on public.application_source_archives;

create policy application_source_archives_owner_select on public.application_source_archives
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy application_source_archives_owner_insert on public.application_source_archives
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy application_source_archives_owner_update on public.application_source_archives
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy application_source_archives_owner_delete on public.application_source_archives
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.application_source_archives to authenticated;
