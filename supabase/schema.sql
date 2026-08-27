-- Optional. The app is fully functional without Supabase (in-memory cache).
-- Run this in the Supabase SQL editor to enable persistence + realtime.

create table if not exists ai_content (
  key text primary key,
  kind text,
  content jsonb,
  created_at timestamptz default now()
);

create table if not exists ai_events (
  id bigint generated always as identity primary key,
  kind text,
  importance text,
  team text,
  headline text,
  body text,
  data jsonb,
  created_at timestamptz default now()
);
create index if not exists ai_events_created_idx on ai_events (created_at desc);

-- realtime feed for the ticker / live pages
alter publication supabase_realtime add table ai_events;

-- user favorites (if you wire Supabase Auth later)
create table if not exists user_favorites (
  user_id uuid references auth.users on delete cascade,
  team text,
  created_at timestamptz default now(),
  primary key (user_id, team)
);
