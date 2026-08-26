create index if not exists applications_user_created_idx
  on public.applications (user_id, created_at desc);
create index if not exists llm_configs_user_created_idx
  on public.llm_configs (user_id, created_at desc);
create index if not exists generation_records_user_created_idx
  on public.generation_records (user_id, created_at desc);
create index if not exists generation_records_application_idx
  on public.generation_records (application_id, created_at desc);
