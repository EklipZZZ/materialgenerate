alter table public.applications enable row level security;
alter table public.llm_configs enable row level security;
alter table public.generation_records enable row level security;

drop policy if exists applications_owner_select on public.applications;
drop policy if exists applications_owner_insert on public.applications;
drop policy if exists applications_owner_update on public.applications;
drop policy if exists applications_owner_delete on public.applications;
create policy applications_owner_select on public.applications
  for select using ((select auth.uid()) = user_id);
create policy applications_owner_insert on public.applications
  for insert with check ((select auth.uid()) = user_id);
create policy applications_owner_update on public.applications
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy applications_owner_delete on public.applications
  for delete using ((select auth.uid()) = user_id);

drop policy if exists llm_configs_owner_select on public.llm_configs;
drop policy if exists llm_configs_owner_insert on public.llm_configs;
drop policy if exists llm_configs_owner_update on public.llm_configs;
drop policy if exists llm_configs_owner_delete on public.llm_configs;
create policy llm_configs_owner_select on public.llm_configs
  for select using ((select auth.uid()) = user_id);
create policy llm_configs_owner_insert on public.llm_configs
  for insert with check ((select auth.uid()) = user_id);
create policy llm_configs_owner_update on public.llm_configs
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy llm_configs_owner_delete on public.llm_configs
  for delete using ((select auth.uid()) = user_id);

drop policy if exists generation_records_owner_select on public.generation_records;
drop policy if exists generation_records_owner_insert on public.generation_records;
drop policy if exists generation_records_owner_update on public.generation_records;
drop policy if exists generation_records_owner_delete on public.generation_records;
create policy generation_records_owner_select on public.generation_records
  for select using ((select auth.uid()) = user_id);
create policy generation_records_owner_insert on public.generation_records
  for insert with check ((select auth.uid()) = user_id);
create policy generation_records_owner_update on public.generation_records
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy generation_records_owner_delete on public.generation_records
  for delete using ((select auth.uid()) = user_id);
