# My Little Kitchen — Projektkontext für Claude Code

Persönliche Koch-PWA fürs iPhone. Single-User (nur ich, eigener Login). Details zu Screens, Design und Datenmodell stehen in `my-little-kitchen-brief.md` — dieses File ist die Kurzfassung der Regeln, die bei jeder Session gelten.

## Stack
- **Next.js** (App Router) + **TypeScript**
- **Tailwind** + **shadcn/ui**
- **Supabase** (Postgres, Auth, Storage) — Free Tier
- Deployment **Vercel** (Hobby)
- KI: **Anthropic API** für Nährwertberechnung und „Was koch ich?"

## Nicht verhandelbar
- **PWA, mobile-first.** Untere Tab-Leiste, Touch-Ziele ≥ 44px, einhändig bedienbar. Ziel: „Zum Home-Bildschirm" ergibt ein Vollbild-App-Icon.
- **Anthropic-API-Calls laufen serverseitig** (Route Handler / Server Action). Der API-Key liegt NUR in einer Server-Env-Variable, NIE im Client-Bundle. Kein `NEXT_PUBLIC_` für den Key.
- **Bilder gehen in Supabase Storage, nicht als Base64 in die DB.** Die DB speichert nur den Storage-Pfad. (Dateien zählen nicht gegen das 500-MB-DB-Limit, strukturierte Daten schon.)
- **Bilder vor Upload clientseitig komprimieren** (max. ~1600px Kante), damit Storage/Ladezeit schlank bleiben.
- **Row Level Security an**, alle Policies `user_id = auth.uid()`.
- **Kostenrahmen = CHF 0.** Supabase Free + Vercel Hobby. Kein Feature einführen, das das sprengt. Einzige variable Kosten: Anthropic-API.

## Design
- Ästhetik „Küchenkarte / Trattoria": warmes Papier, Tomatenrot als Signatur, Serif für Titel. Tokens siehe Brief / Design-Handoff.
- Die visuelle Referenz aus Claude Design (Handoff-Bundle / Screenshots im Ordner) ist die Vorlage — daran halten, nicht neu erfinden.

## KI-Details
- Modellwahl: günstiges Modell (Haiku-Klasse) reicht für Nährwerte & Vorschläge. Sonnet nur wo nötig.
- Nährwert-Prompt: Antwort als striktes JSON (`total`, `per_ingredient`, `note`). Screenshots als Bild-Input mitgeben.
- **Nährwerte pro 100 g / pro Stück speichern** und mit der Rezeptmenge hochrechnen — nicht die rohe Menge aus einem Einzelrezept ablegen.

## Datenmodell (Kurz)
`recipes`, `recipe_ingredients` (oder jsonb im Rezept), `ingredients` (Bibliothek, auto-befüllt, dedupliziert nach Name), `longlist`. Volles Schema in der SQL-Migration. Storage-Buckets für Fotos, Zutaten-Screenshots, Merklisten-Bilder.

## Betrieb / Fallstricke
- **Supabase Free pausiert nach 7 Tagen ohne DB-Request.** Durch normale Nutzung oder wöchentlichen Cron-Ping wachhalten.
- **Keine automatischen Backups im Free-Plan.** Bei Bedarf später GitHub-Actions-Backup einrichten.
- Neue Projekte brauchen explizite Postgres-Grants für PostgREST — in der Migration bereits enthalten.

## Arbeitsweise
- Erst Projektgerüst + Supabase-Schema, dann Screens, dann KI-Routen, zuletzt PWA-Feinschliff & Deployment.
- Kleine, überprüfbare Schritte. Nach jedem größeren Baustein kurz zusammenfassen, was läuft und was als Nächstes kommt.
