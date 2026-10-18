-- One private, revisioned document per account. Public keys cannot read other accounts.
create table if not exists public.form_sync_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.form_sync_documents enable row level security;
revoke all on public.form_sync_documents from anon, authenticated;
grant select on public.form_sync_documents to authenticated;
create policy "Read own workout document" on public.form_sync_documents for select to authenticated using ((select auth.uid()) = user_id);

-- Writes only through compare-and-swap; direct client updates are intentionally denied.
create or replace function public.form_sync_write(expected_revision bigint, document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare account_id uuid := auth.uid(); saved public.form_sync_documents%rowtype;
begin
  if account_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if expected_revision is null or expected_revision < 0 or
     document is null or document->>'schemaVersion' is distinct from '1' or
     document->>'appVersion' is distinct from '1.0.0' or
     jsonb_typeof(document->'data') is distinct from 'object' or
     pg_column_size(document) > 20971520 then
    raise exception 'invalid_document' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.form_sync_documents(user_id,revision,payload)
    values(account_id,1,document) on conflict (user_id) do nothing returning * into saved;
  else
    update public.form_sync_documents set payload=document,revision=revision+1,updated_at=now()
    where user_id=account_id and revision=expected_revision returning * into saved;
  end if;
  if not found then raise exception 'revision_conflict' using errcode = '40001'; end if;
  return jsonb_build_object('revision',saved.revision,'payload',saved.payload);
end;
$$;
revoke all on function public.form_sync_write(bigint,jsonb) from public,anon;
grant execute on function public.form_sync_write(bigint,jsonb) to authenticated;
