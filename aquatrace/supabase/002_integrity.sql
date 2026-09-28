-- AquaTrace: tamper evidence. Run after schema.sql, in the Supabase SQL editor.

-- 1. Fingerprint of every saved dataset. The server recomputes it on every read;
--    a row edited outside the app no longer matches.
alter table public.water_datasets add column if not exists payload_sha256 text;

-- 2. Append-only, hash-chained audit log. Each event's hash covers the previous
--    event's hash, so changing or deleting any past event breaks every hash after it.
create table if not exists public.audit_events (
  seq            bigserial primary key,
  created_at     timestamptz not null,
  kind           text not null,          -- e.g. file.ingested, dataset.saved, corpus.built
  subject        text not null,          -- file name, dataset id, ...
  content_sha256 text not null,          -- fingerprint of the thing the event is about
  detail         jsonb not null default '{}'::jsonb,
  prev_hash      text not null unique,   -- unique: two writers cannot fork the chain
  hash           text not null unique
);

alter table public.audit_events enable row level security;

-- Block UPDATE and DELETE for everyone, including the service role.
-- (A database owner can still drop the trigger; the hash chain is what makes that visible.)
create or replace function public.audit_events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update before update or delete on public.audit_events
  for each row execute function public.audit_events_append_only();

notify pgrst, 'reload schema';
