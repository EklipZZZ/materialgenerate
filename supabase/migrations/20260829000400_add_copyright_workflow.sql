-- Softreg workflow v1: structured rights holders, material slots and durable jobs.
-- Existing applications/generation_records columns remain for backwards compatibility.

alter table public.applications
  add column if not exists work_type text not null default 'original'
    check (work_type in ('original', 'modified')),
  add column if not exists development_method text not null default 'independent'
    check (development_method in ('independent', 'cooperative', 'commissioned', 'assigned_task')),
  add column if not exists rights_acquisition_method text not null default 'original'
    check (rights_acquisition_method in ('original', 'transfer', 'inheritance', 'assumption')),
  add column if not exists rights_scope text not null default 'all'
    check (rights_scope in ('all', 'partial')),
  add column if not exists rights_scope_description text,
  add column if not exists original_registration_number text,
  add column if not exists modification_description text,
  add column if not exists first_publication_date text,
  add column if not exists first_publication_country text,
  add column if not exists first_publication_city text,
  add column if not exists application_method text not null default 'copyright_holder'
    check (application_method in ('copyright_holder', 'agent')),
  add column if not exists applicant_address text,
  add column if not exists postal_code text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text;

create table if not exists public.copyright_holders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  holder_type text not null check (holder_type in ('person', 'organization')),
  name text not null,
  category text not null,
  document_type text not null,
  document_number text not null,
  nationality text not null default '中国',
  province text not null default '',
  city text not null default '',
  park text,
  birth_or_established_date text,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists copyright_holders_application_idx
  on public.copyright_holders (application_id, sort_order);
create index if not exists copyright_holders_user_idx
  on public.copyright_holders (user_id, created_at desc);

-- Preserve the old single-company form as a real organization holder.
insert into public.copyright_holders (
  user_id, application_id, holder_type, name, category, document_type,
  document_number, nationality, province, city, sort_order
)
select
  a.user_id,
  a.id,
  'organization',
  coalesce(nullif(trim(a.company_name), ''), '历史申请主体'),
  '企业法人',
  '统一社会信用代码证书',
  coalesce(nullif(trim(a.credit_code), ''), '未提供'),
  '中国',
  '',
  '',
  0
from public.applications a
where (nullif(trim(a.company_name), '') is not null or nullif(trim(a.credit_code), '') is not null)
  and not exists (
    select 1 from public.copyright_holders h where h.application_id = a.id
  );

create table if not exists public.application_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  generation_record_id uuid references public.generation_records(id) on delete set null,
  holder_id uuid references public.copyright_holders(id) on delete set null,
  kind text not null check (kind in (
    'source_code_docx', 'source_code_pdf', 'user_manual_docx', 'user_manual_pdf',
    'application_summary_pdf', 'cooperation_agreement', 'signature_page',
    'holder_identity_proof', 'commission_agreement', 'task_order'
  )),
  status text not null default 'missing' check (status in (
    'missing', 'generated', 'uploaded', 'awaiting_official', 'awaiting_user', 'invalid'
  )),
  required boolean not null default false,
  source text not null default 'uploaded' check (source in ('generated', 'uploaded', 'official')),
  file_name text,
  object_key text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  checksum text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_materials_application_idx
  on public.application_materials (application_id, created_at desc);
create index if not exists application_materials_user_idx
  on public.application_materials (user_id, created_at desc);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  current_step text not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  provider text check (provider is null or provider in ('openai', 'deepseek')),
  model text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists generation_jobs_active_application_idx
  on public.generation_jobs (application_id)
  where status in ('queued', 'running');
create index if not exists generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc);
create index if not exists generation_jobs_application_created_idx
  on public.generation_jobs (application_id, created_at desc);

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  step text not null,
  message text not null,
  progress integer check (progress is null or progress between 0 and 100),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_events_job_created_idx
  on public.job_events (job_id, created_at);

alter table public.generation_records
  add column if not exists job_id uuid references public.generation_jobs(id) on delete set null,
  add column if not exists source_code_pdf_object_key text,
  add column if not exists user_manual_pdf_object_key text,
  add column if not exists application_summary_pdf_object_key text;

create index if not exists generation_records_job_idx
  on public.generation_records (job_id);

drop trigger if exists copyright_holders_set_updated_at on public.copyright_holders;
create trigger copyright_holders_set_updated_at before update on public.copyright_holders
for each row execute function public.set_updated_at();

drop trigger if exists application_materials_set_updated_at on public.application_materials;
create trigger application_materials_set_updated_at before update on public.application_materials
for each row execute function public.set_updated_at();

drop trigger if exists generation_jobs_set_updated_at on public.generation_jobs;
create trigger generation_jobs_set_updated_at before update on public.generation_jobs
for each row execute function public.set_updated_at();

alter table public.copyright_holders enable row level security;
alter table public.application_materials enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.job_events enable row level security;

drop policy if exists copyright_holders_owner_select on public.copyright_holders;
drop policy if exists copyright_holders_owner_insert on public.copyright_holders;
drop policy if exists copyright_holders_owner_update on public.copyright_holders;
drop policy if exists copyright_holders_owner_delete on public.copyright_holders;
create policy copyright_holders_owner_select on public.copyright_holders
  for select using ((select auth.uid()) = user_id);
create policy copyright_holders_owner_insert on public.copyright_holders
  for insert with check ((select auth.uid()) = user_id);
create policy copyright_holders_owner_update on public.copyright_holders
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy copyright_holders_owner_delete on public.copyright_holders
  for delete using ((select auth.uid()) = user_id);

drop policy if exists application_materials_owner_select on public.application_materials;
drop policy if exists application_materials_owner_insert on public.application_materials;
drop policy if exists application_materials_owner_update on public.application_materials;
drop policy if exists application_materials_owner_delete on public.application_materials;
create policy application_materials_owner_select on public.application_materials
  for select using ((select auth.uid()) = user_id);
create policy application_materials_owner_insert on public.application_materials
  for insert with check ((select auth.uid()) = user_id);
create policy application_materials_owner_update on public.application_materials
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy application_materials_owner_delete on public.application_materials
  for delete using ((select auth.uid()) = user_id);

drop policy if exists generation_jobs_owner_select on public.generation_jobs;
drop policy if exists generation_jobs_owner_insert on public.generation_jobs;
drop policy if exists generation_jobs_owner_update on public.generation_jobs;
drop policy if exists generation_jobs_owner_delete on public.generation_jobs;
create policy generation_jobs_owner_select on public.generation_jobs
  for select using ((select auth.uid()) = user_id);
create policy generation_jobs_owner_insert on public.generation_jobs
  for insert with check ((select auth.uid()) = user_id);
create policy generation_jobs_owner_update on public.generation_jobs
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy generation_jobs_owner_delete on public.generation_jobs
  for delete using ((select auth.uid()) = user_id);

drop policy if exists job_events_owner_select on public.job_events;
drop policy if exists job_events_owner_insert on public.job_events;
drop policy if exists job_events_owner_update on public.job_events;
drop policy if exists job_events_owner_delete on public.job_events;
create policy job_events_owner_select on public.job_events
  for select using ((select auth.uid()) = user_id);
create policy job_events_owner_insert on public.job_events
  for insert with check ((select auth.uid()) = user_id);
create policy job_events_owner_update on public.job_events
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy job_events_owner_delete on public.job_events
  for delete using ((select auth.uid()) = user_id);
