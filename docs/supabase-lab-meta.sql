-- Ejecuta este script en Supabase SQL Editor para habilitar metadatos de labs.

alter table public.labs
  add column if not exists slug text,
  add column if not exists cover_image_url text,
  add column if not exists accent_color text;

-- Opcional: relleno inicial de slug para labs existentes sin slug.
update public.labs
set slug = regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')
where (slug is null or length(trim(slug)) = 0)
  and title is not null;

-- Limpieza básica de guiones extremos.
update public.labs
set slug = regexp_replace(regexp_replace(slug, '^-+', ''), '-+$', '')
where slug is not null;

-- Recomendado para navegación por slug.
create index if not exists labs_slug_idx on public.labs (slug);

-- Recomendado para evitar slugs repetidos (si tienes duplicados, corrígelos antes de ejecutar).
create unique index if not exists labs_slug_unique_idx
  on public.labs (lower(slug))
  where slug is not null and length(trim(slug)) > 0;

-- Validación opcional para color hexadecimal.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'labs_accent_color_hex_chk'
  ) then
    alter table public.labs
      add constraint labs_accent_color_hex_chk
      check (
        accent_color is null
        or accent_color ~* '^#([0-9a-f]{6})$'
      );
  end if;
end $$;
