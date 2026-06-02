-- Run in Supabase SQL Editor
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  stream_id text not null,
  playback_id text not null,
  title text default 'بث مباشر',
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.live_streams enable row level security;

create policy "anyone can read streams" on public.live_streams for select using (true);
create policy "anyone can insert stream" on public.live_streams for insert with check (true);
create policy "anyone can update stream" on public.live_streams for update using (true);
