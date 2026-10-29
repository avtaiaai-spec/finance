-- Run once in Supabase SQL Editor. Safe to re-run; no financial data is deleted.
begin;
create table if not exists public.finance_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.finance_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, revision)
);
alter table public.finance_state enable row level security;
alter table public.finance_history enable row level security;
revoke all on public.finance_state, public.finance_history from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.finance_state, public.finance_history to authenticated;
drop policy if exists finance_state_owner_read on public.finance_state;
create policy finance_state_owner_read on public.finance_state for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists finance_history_owner_read on public.finance_history;
create policy finance_history_owner_read on public.finance_history for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.save_finance_state(p_expected_revision bigint, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  current_row public.finance_state%rowtype;
  result_row public.finance_state%rowtype;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_data is null or
     pg_catalog.jsonb_typeof(p_data) <> 'object' or p_data->>'version' is distinct from '1' or
     pg_catalog.jsonb_typeof(p_data->'transactions') is distinct from 'array' or
     pg_catalog.jsonb_typeof(p_data->'categories') is distinct from 'array' or
     pg_catalog.jsonb_typeof(p_data->'budgets') is distinct from 'array' or
     pg_catalog.jsonb_typeof(p_data->'goals') is distinct from 'array' or
     pg_catalog.jsonb_typeof(p_data->'settings') is distinct from 'object' or
     pg_catalog.octet_length(p_data::text) > 10485760 then
    raise exception 'Invalid finance data (maximum 10 MiB)' using errcode = '22023';
  end if;
  -- Serialize all writes for this account, including concurrent first uploads.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  select * into current_row from public.finance_state where user_id = owner_id for update;
  if coalesce(current_row.revision, 0) <> p_expected_revision then
    raise exception 'Revision conflict; refresh and merge' using errcode = '40001';
  end if;
  if current_row.user_id is not null then
    insert into public.finance_history(user_id, revision, payload)
      values(owner_id, current_row.revision, current_row.payload) on conflict do nothing;
    update public.finance_state set payload = p_data, revision = current_row.revision + 1, updated_at = now()
      where user_id = owner_id returning * into result_row;
  else
    insert into public.finance_state(user_id,revision,payload) values(owner_id,1,p_data) returning * into result_row;
  end if;
  delete from public.finance_history where user_id = owner_id and created_at < now() - interval '30 days';
  return pg_catalog.jsonb_build_object('revision',result_row.revision,'payload',result_row.payload,'updated_at',result_row.updated_at);
end;
$$;
revoke all on function public.save_finance_state(bigint,jsonb) from public, anon;
grant execute on function public.save_finance_state(bigint,jsonb) to authenticated;
commit;
