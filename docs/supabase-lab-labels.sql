-- Lab labels/tags (NEW, TOP, AUDIO, etc.)
-- Run once in Supabase SQL Editor.

alter table public.labs
add column if not exists labels text[] not null default '{}'::text[];

