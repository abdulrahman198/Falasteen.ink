-- Run in Supabase SQL Editor

-- 1. Create storage bucket (run this first in Supabase Storage settings, or via SQL)
insert into storage.buckets (id, name, public) values ('vault-files', 'vault-files', true)
on conflict do nothing;

-- 2. Allow anyone to upload to vault-files bucket
create policy "anyone can upload vault files"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'vault-files');

create policy "anyone can read vault files"
  on storage.objects for select
  to anon
  using (bucket_id = 'vault-files');

-- 3. Create metadata table
create table if not exists public.vault_files (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text default 'document',
  file_path text not null,
  file_url text not null,
  file_size bigint default 0,
  file_type text,
  created_at timestamptz default now()
);

alter table public.vault_files enable row level security;

create policy "anyone can read vault_files" on public.vault_files for select using (true);
create policy "anyone can insert vault_files" on public.vault_files for insert with check (true);
