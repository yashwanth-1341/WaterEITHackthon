-- AquaTrace: saved datasets.
-- Run in the Supabase SQL editor (or `supabase db push`).
create table if not exists public.water_datasets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  company     text,
  period      text,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists water_datasets_created_at_idx on public.water_datasets (created_at desc);

-- Row-level security on, with no public policies: only the server (service role key,
-- used in app/api/datasets) can read or write. Add per-user policies before
-- exposing this table to the browser.
alter table public.water_datasets enable row level security;
