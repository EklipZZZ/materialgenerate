-- Browser-assisted filing workflow.
-- The browser extension never receives Supabase credentials. The web app
-- creates these rows and relays allowlisted, short-lived material URLs.

create table if not exists public.filing_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  status text not null default 'created' check (status in (
    'created', 'waiting_extension', 'opening_portal', 'waiting_login',
    'filling', 'waiting_review', 'uploading', 'waiting_user',
    'completed', 'failed', 'cancelled'
  )),
  current_step text not null default 'pairing',
  progress integer not null default 0 check (progress between 0 and 100),
  adapter_version text not null default 'r11-v1',
  extension_version text,
  browser text not null default 'chrome' check (browser in ('chrome', 'edge')),
  input_application_updated_at timestamptz,
  input_materials jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists filing_jobs_active_application_idx
  on public.filing_jobs (application_id)
  where status in (
    'created', 'waiting_extension', 'opening_portal', 'waiting_login',
    'filling', 'waiting_review', 'uploading', 'waiting_user'
  );
create index if not exists filing_jobs_user_created_idx
  on public.filing_jobs (user_id, created_at desc);
create index if not exists filing_jobs_application_created_idx
  on public.filing_jobs (application_id, created_at desc);

create table if not exists public.filing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.filing_jobs(id) on delete cascade,
  step text not null,
  code text not null,
  progress integer check (progress is null or progress between 0 and 100),
  extension_version text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists filing_events_job_created_idx
  on public.filing_events (job_id, created_at);
create index if not exists filing_events_user_created_idx
  on public.filing_events (user_id, created_at desc);

drop trigger if exists filing_jobs_set_updated_at on public.filing_jobs;
create trigger filing_jobs_set_updated_at before update on public.filing_jobs
for each row execute function public.set_updated_at();

alter table public.filing_jobs enable row level security;
alter table public.filing_events enable row level security;

drop policy if exists filing_jobs_owner_select on public.filing_jobs;
drop policy if exists filing_jobs_owner_insert on public.filing_jobs;
drop policy if exists filing_jobs_owner_update on public.filing_jobs;
drop policy if exists filing_jobs_owner_delete on public.filing_jobs;
create policy filing_jobs_owner_select on public.filing_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy filing_jobs_owner_insert on public.filing_jobs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy filing_jobs_owner_update on public.filing_jobs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy filing_jobs_owner_delete on public.filing_jobs
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists filing_events_owner_select on public.filing_events;
drop policy if exists filing_events_owner_insert on public.filing_events;
drop policy if exists filing_events_owner_update on public.filing_events;
drop policy if exists filing_events_owner_delete on public.filing_events;
create policy filing_events_owner_select on public.filing_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy filing_events_owner_insert on public.filing_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy filing_events_owner_update on public.filing_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy filing_events_owner_delete on public.filing_events
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.filing_jobs to authenticated;
grant select, insert, update, delete on public.filing_events to authenticated;
