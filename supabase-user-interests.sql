-- Supabase table for FALASTEEN.INK Discovery Feed interests.
-- Run this in Supabase SQL Editor.

create table if not exists public.user_interests (
  user_id uuid not null,
  tag text not null,
  score numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, tag)
);

alter table public.user_interests enable row level security;

create policy "Users can read own interests"
on public.user_interests for select
using (auth.uid() = user_id);

create policy "Users can insert own interests"
on public.user_interests for insert
with check (auth.uid() = user_id);

create policy "Users can update own interests"
on public.user_interests for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
