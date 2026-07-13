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
