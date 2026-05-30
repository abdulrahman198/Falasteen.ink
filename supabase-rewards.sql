-- FALASTEEN.INK Rewards System tables
-- Run this in Supabase SQL Editor.

create table if not exists public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  xp integer not null default 0,
  level integer not null default 1,
  points integer not null default 0,
  token_balance numeric not null default 0,
  badges jsonb not null default '[]'::jsonb,
  streak integer not null default 0,
  last_login date,
  missions jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  amount numeric not null default 1,
  xp integer not null default 0,
  points integer not null default 0,
  token_reward numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.user_rewards enable row level security;
alter table public.reward_events enable row level security;

create policy "Users can read rewards"
on public.user_rewards for select
using (true);

create policy "Users can insert own rewards"
on public.user_rewards for insert
with check (auth.uid() = user_id);

create policy "Users can update own rewards"
on public.user_rewards for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read reward events"
on public.reward_events for select
using (auth.uid() = user_id);

create policy "Users can insert own reward events"
on public.reward_events for insert
with check (auth.uid() = user_id);
