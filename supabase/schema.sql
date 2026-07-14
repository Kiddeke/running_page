-- Faith activity log, shared between running_page's Faith tab and the
-- running-faith-mobile Expo app. Run this once in the Supabase SQL editor
-- (Dashboard > SQL Editor) after creating the project, before either app is
-- pointed at it. Keep this file identical to the copy in running-faith-mobile.
--
-- Single-user personal project: row-level security scopes every row to the
-- signed-in user's own auth.uid(), so even though the anon key is safe to
-- ship in both client apps (Supabase's intended design), nobody can read or
-- write another user's rows without being authenticated as them.

create table if not exists faith_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('mass', 'confession', 'prayer', 'almsgiving', 'fasting')),
  date date not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table faith_activities enable row level security;

create policy "Users can manage their own faith activities"
  on faith_activities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists faith_activities_user_date_idx
  on faith_activities (user_id, date desc);

-- Running activities, synced from this repo's existing scheduled Strava
-- sync (see run_page/sync_activities_to_supabase.py and its step in
-- .github/workflows/run_data_sync.yml) — not written by either app
-- directly. id is the real Strava/running_page activity id (run_id), used
-- as the upsert conflict target so re-syncing is idempotent.
--
-- Unlike faith_activities, this is public-read: running data is already
-- published with no auth on this web dashboard, so gating it behind
-- sign-in here would be a step backward, not a privacy improvement. Only
-- the service_role key (held exclusively by the GitHub Actions sync job,
-- never shipped in either app) can write, since service_role bypasses RLS
-- entirely — anon/authenticated get read-only access via the policy below.
create table if not exists activities (
  id bigint primary key,
  type text not null,
  name text not null,
  distance double precision not null,
  moving_time integer not null,
  start_date_local timestamp not null,
  elevation_gain double precision,
  average_heartrate double precision,
  updated_at timestamptz not null default now()
);

alter table activities enable row level security;

create policy "Anyone can read activities"
  on activities
  for select
  using (true);

create index if not exists activities_start_date_local_idx
  on activities (start_date_local desc);
