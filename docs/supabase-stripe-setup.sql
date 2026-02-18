-- Stripe payments setup
-- Run this once in Supabase SQL Editor.

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  user_id uuid not null references auth.users(id) on delete cascade,
  lab_id uuid not null references public.labs(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency in ('USD', 'MXN')),
  coupon_code text,
  status text not null check (status in ('created', 'paid', 'failed', 'expired', 'refunded')),
  source text not null default 'stripe',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_orders_user_id
  on public.payment_orders(user_id);

create index if not exists idx_payment_orders_lab_id
  on public.payment_orders(lab_id);

create index if not exists idx_payment_orders_status
  on public.payment_orders(status);

alter table public.payment_orders enable row level security;

drop policy if exists "payment_orders_select_own" on public.payment_orders;
create policy "payment_orders_select_own"
on public.payment_orders
for select
using (auth.uid() = user_id);

-- Writes happen from server routes using service role key.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payment_orders_updated_at on public.payment_orders;
create trigger trg_payment_orders_updated_at
before update on public.payment_orders
for each row execute procedure public.set_updated_at();
