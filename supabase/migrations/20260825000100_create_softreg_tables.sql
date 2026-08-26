create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  software_full_name text,
  software_short_name text,
  version text default 'V1.0',
  software_category text,
  development_date text,
  is_published boolean not null default false,
  development_hardware text,
  runtime_hardware text,
  development_os text,
  development_tools text,
  runtime_platform text,
  runtime_environment text,
  programming_language text,
  source_code_lines integer not null default 0 check (source_code_lines >= 0),
  development_purpose text,
  target_industry text,
  main_functions text,
  technical_features text,
  company_name text,
  credit_code text,
  status text not null default 'draft'
    check (status in ('draft', 'enriched', 'generating', 'completed', 'archived')),
  enriched_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.llm_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  provider text not null check (provider in ('openai', 'deepseek')),
  model text not null,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version integer not null default 1,
  key_last4 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  file_name text not null,
  source_code_summary text,
  source_code_object_key text,
  user_manual_object_key text,
  collection_form_object_key text,
  provider text not null check (provider in ('openai', 'deepseek')),
  model text not null,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed', 'unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();

drop trigger if exists llm_configs_set_updated_at on public.llm_configs;
create trigger llm_configs_set_updated_at before update on public.llm_configs
for each row execute function public.set_updated_at();

drop trigger if exists generation_records_set_updated_at on public.generation_records;
create trigger generation_records_set_updated_at before update on public.generation_records
for each row execute function public.set_updated_at();
