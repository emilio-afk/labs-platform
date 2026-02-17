-- Learning state persistence: notes + checklist + quiz answers
-- Run this once in Supabase SQL Editor.

create table if not exists public.day_learning_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lab_id uuid not null references public.labs(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  notes text not null default '',
  checklist_selections jsonb not null default '{}'::jsonb,
  quiz_answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lab_id, day_number)
);

create index if not exists idx_day_learning_state_user
  on public.day_learning_state(user_id);

create index if not exists idx_day_learning_state_lab_day
  on public.day_learning_state(lab_id, day_number);

alter table public.day_learning_state enable row level security;

drop policy if exists "day_state_select_own" on public.day_learning_state;
create policy "day_state_select_own"
on public.day_learning_state
for select
using (auth.uid() = user_id);

drop policy if exists "day_state_insert_own" on public.day_learning_state;
create policy "day_state_insert_own"
on public.day_learning_state
for insert
with check (auth.uid() = user_id);

drop policy if exists "day_state_update_own" on public.day_learning_state;
create policy "day_state_update_own"
on public.day_learning_state
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "day_state_delete_own" on public.day_learning_state;
create policy "day_state_delete_own"
on public.day_learning_state
for delete
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_day_learning_state_updated_at on public.day_learning_state;
create trigger trg_day_learning_state_updated_at
before update on public.day_learning_state
for each row execute procedure public.set_updated_at();
