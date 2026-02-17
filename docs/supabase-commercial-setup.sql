-- Commercial setup: prices + coupons
-- Run this in Supabase SQL Editor once.

create table if not exists public.lab_prices (
  id uuid primary key default gen_random_uuid(),
  lab_id uuid not null references public.labs(id) on delete cascade,
  currency text not null check (currency in ('USD', 'MXN')),
  amount_cents integer not null check (amount_cents > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lab_id, currency)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  percent_off integer check (percent_off between 1 and 100),
  amount_off_cents integer check (amount_off_cents > 0),
  currency text check (currency in ('USD', 'MXN')),
  lab_id uuid references public.labs(id) on delete cascade,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (discount_type = 'percent' and percent_off is not null and amount_off_cents is null and currency is null)
    or
    (discount_type = 'fixed' and amount_off_cents is not null and currency is not null and percent_off is null)
  )
);

create index if not exists idx_lab_prices_lab_id on public.lab_prices(lab_id);
create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_coupons_lab_id on public.coupons(lab_id);
create index if not exists idx_coupons_is_active on public.coupons(is_active);

-- Optional: keep updated_at fresh via trigger (if you already use a generic trigger, skip this)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lab_prices_updated_at on public.lab_prices;
create trigger trg_lab_prices_updated_at
before update on public.lab_prices
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_coupons_updated_at on public.coupons;
create trigger trg_coupons_updated_at
before update on public.coupons
for each row execute procedure public.set_updated_at();
