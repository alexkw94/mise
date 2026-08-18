-- ============================================================
--  My Little Kitchen — Supabase Schema
--  Im Supabase-Dashboard unter: SQL Editor → New query → einfügen → Run
--  Einmalig ausführen. Idempotent gehalten (IF NOT EXISTS wo möglich).
-- ============================================================

-- ── Extensions ─────────────────────────────────────────────
create extension if not exists "pgcrypto";  -- für gen_random_uuid()

-- ============================================================
--  TABELLEN
-- ============================================================

-- Rezepte
create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Ohne Titel',
  body        text default '',
  image_path  text,                       -- Pfad in Storage-Bucket 'recipe-photos'
  servings    int  default 1,
  nutri       jsonb,                      -- { total:{kcal,protein_g,fat_g,carbs_g}, per_ingredient:[...], note }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Zutaten pro Rezept
create table if not exists public.recipe_ingredients (
  id          uuid primary key default gen_random_uuid(),
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  amount      text default '',            -- frei: '3 Stk', '200 g'
  url         text default '',            -- Coop / Migros Produktlink
  shot_path   text,                       -- Pfad in Storage-Bucket 'ingredient-shots'
  sort_order  int  default 0
);

-- Zutaten-Bibliothek (auto-befüllt, dedupliziert nach Name je User)
create table if not exists public.ingredients (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  url              text default '',
  shot_path        text,
  nutri_per_100g   jsonb,                 -- { kcal, protein_g, fat_g, carbs_g }
  basis            text default '100 g',  -- '100 g' oder 'Stück'
  updated_at       timestamptz not null default now(),
  unique (user_id, name)                  -- verhindert Dubletten pro User
);

-- Merkliste (Longlist)
create table if not exists public.longlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  note        text default '',
  url         text default '',
  image_path  text,                       -- Pfad in Storage-Bucket 'longlist-images'
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Indizes für schnelle Abfragen je User
create index if not exists idx_recipes_user       on public.recipes(user_id);
create index if not exists idx_recipe_ing_recipe  on public.recipe_ingredients(recipe_id);
create index if not exists idx_ingredients_user   on public.ingredients(user_id);
create index if not exists idx_longlist_user      on public.longlist(user_id);

-- ============================================================
--  ROW LEVEL SECURITY
--  Jeder User sieht/ändert nur seine eigenen Zeilen.
-- ============================================================

alter table public.recipes            enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.ingredients        enable row level security;
alter table public.longlist           enable row level security;

-- recipes
create policy "own recipes select" on public.recipes for select using (auth.uid() = user_id);
create policy "own recipes insert" on public.recipes for insert with check (auth.uid() = user_id);
create policy "own recipes update" on public.recipes for update using (auth.uid() = user_id);
create policy "own recipes delete" on public.recipes for delete using (auth.uid() = user_id);

-- recipe_ingredients
create policy "own ri select" on public.recipe_ingredients for select using (auth.uid() = user_id);
create policy "own ri insert" on public.recipe_ingredients for insert with check (auth.uid() = user_id);
create policy "own ri update" on public.recipe_ingredients for update using (auth.uid() = user_id);
create policy "own ri delete" on public.recipe_ingredients for delete using (auth.uid() = user_id);

-- ingredients
create policy "own ing select" on public.ingredients for select using (auth.uid() = user_id);
create policy "own ing insert" on public.ingredients for insert with check (auth.uid() = user_id);
create policy "own ing update" on public.ingredients for update using (auth.uid() = user_id);
create policy "own ing delete" on public.ingredients for delete using (auth.uid() = user_id);

-- longlist
create policy "own ll select" on public.longlist for select using (auth.uid() = user_id);
create policy "own ll insert" on public.longlist for insert with check (auth.uid() = user_id);
create policy "own ll update" on public.longlist for update using (auth.uid() = user_id);
create policy "own ll delete" on public.longlist for delete using (auth.uid() = user_id);

-- ============================================================
--  GRANTS für PostgREST (Data API)
--  Nötig für Projekte, die nach dem 30.05.2026 erstellt wurden.
--  RLS bleibt die eigentliche Absicherung; grants öffnen nur den API-Zugang.
-- ============================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.recipes, public.recipe_ingredients, public.ingredients, public.longlist
  to authenticated;

-- ============================================================
--  STORAGE BUCKETS
--  Private Buckets (public = false). Zugriff über signed URLs / RLS.
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('recipe-photos',    'recipe-photos',    false),
  ('ingredient-shots', 'ingredient-shots', false),
  ('longlist-images',  'longlist-images',  false)
on conflict (id) do nothing;

-- Storage-Policies: User darf nur in „seinem" Ordner lesen/schreiben.
-- Konvention: Dateien unter  <bucket>/<auth.uid()>/<dateiname>
-- Damit ist der erste Pfad-Abschnitt die User-ID.

create policy "kitchen storage read"
  on storage.objects for select
  using (
    bucket_id in ('recipe-photos','ingredient-shots','longlist-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kitchen storage insert"
  on storage.objects for insert
  with check (
    bucket_id in ('recipe-photos','ingredient-shots','longlist-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kitchen storage update"
  on storage.objects for update
  using (
    bucket_id in ('recipe-photos','ingredient-shots','longlist-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kitchen storage delete"
  on storage.objects for delete
  using (
    bucket_id in ('recipe-photos','ingredient-shots','longlist-images')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
--  FERTIG. Zur Kontrolle:
--  select tablename from pg_tables where schemaname = 'public';
-- ============================================================
