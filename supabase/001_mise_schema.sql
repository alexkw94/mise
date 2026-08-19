-- mise — Schema für ein *mitbenutztes* Supabase-Projekt.
--
-- Alle Objekte tragen das Präfix `mise_`, damit sie neben einem bestehenden
-- Projekt stehen können, ohne dessen Tabellen zu berühren. Ausführen im
-- Supabase-Dashboard unter SQL Editor → New query → Run.
--
-- Ausführen ist gefahrlos: es werden ausschliesslich neue Tabellen angelegt,
-- nichts Bestehendes wird geändert oder gelöscht.

-- ── Rezepte ────────────────────────────────────────────────────────────────
-- Zutaten und Nährwerte liegen als jsonb im Rezept statt in eigenen Tabellen.
-- Für den Abgleich ist das der entscheidende Vorteil: ein Rezept ist genau
-- eine Zeile, also eine atomare Änderung — kein halb übertragenes Rezept.
create table if not exists public.mise_recipes (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default '',
  body        text not null default '',
  categories  text[] not null default '{}',
  ings        jsonb  not null default '[]',
  nutri       jsonb,
  photo_id    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Tombstone: ohne dieses Feld würde ein auf dem iPhone gelöschtes Rezept
  -- beim nächsten Abgleich vom MacBook wieder auferstehen.
  deleted_at  timestamptz
);

-- ── Merkliste ──────────────────────────────────────────────────────────────
create table if not exists public.mise_longlist (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  note        text not null default '',
  url         text not null default '',
  image_id    text,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── Selbst eingetragene Nährwerte ──────────────────────────────────────────
-- Schlüssel ist der Zutatenname pro Benutzer; die eingebaute Tabelle in der
-- App bleibt der Fallback.
create table if not exists public.mise_library (
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  basis            text not null default '100g' check (basis in ('100g', 'stk')),
  nutri            jsonb,
  grams_per_piece  numeric,
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  primary key (user_id, name)
);

-- Der Abgleich fragt immer "was hat sich seit X geändert" — dafür indexieren.
create index if not exists mise_recipes_sync_idx  on public.mise_recipes  (user_id, updated_at);
create index if not exists mise_longlist_sync_idx on public.mise_longlist (user_id, updated_at);
create index if not exists mise_library_sync_idx  on public.mise_library  (user_id, updated_at);

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Ohne diese Policies könnte jeder mit dem (öffentlichen) Anon-Key alles
-- lesen. Sie sind das, was die Daten schützt — nicht der Schlüssel.
alter table public.mise_recipes  enable row level security;
alter table public.mise_longlist enable row level security;
alter table public.mise_library  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['mise_recipes', 'mise_longlist', 'mise_library'] loop
    execute format('drop policy if exists mise_owner_select on public.%I', t);
    execute format('drop policy if exists mise_owner_insert on public.%I', t);
    execute format('drop policy if exists mise_owner_update on public.%I', t);
    execute format('drop policy if exists mise_owner_delete on public.%I', t);

    execute format(
      'create policy mise_owner_select on public.%I for select using (auth.uid() = user_id)', t);
    execute format(
      'create policy mise_owner_insert on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format(
      'create policy mise_owner_update on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format(
      'create policy mise_owner_delete on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;
