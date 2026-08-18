# My Little Kitchen — Design-Brief & Funktionale Spezifikation

*Briefing-Dokument für Claude Design (UI) und Claude Code (Implementierung). Mobile-first PWA fürs iPhone. Stack: Next.js + Tailwind + shadcn/ui + Supabase, Deployment auf Vercel.*

---

## 1. Das Produkt in einem Satz

Eine persönliche Kochapp fürs Handy, in der ich (1) selbst gekochte Rezepte mit Foto, Zutaten und Nährwerten festhalte, (2) aus vorhandenen Lebensmitteln per KI ein passendes Rezept vorschlagen lasse, und (3) eine Merkliste aus Videolinks, Bildern und Notizen für Rezepte pflege, die ich noch ausprobieren will.

**Nutzer:** Ich allein (Single-User, eigener Login). Basel, kocht gern — Neapolitan Pizza, Grillen. Bedient die App am Herd, am Handy, oft mit einer Hand und schmutzigen Fingern.

**Die eine Aufgabe der App:** Ein gekochtes Gericht in unter einer Minute festhalten — Foto knipsen, Zutaten eintippen, fertig. Alles andere ist sekundär.

---

## 2. Design-Richtung

**Ausgangspunkt (bewährt, darf verfeinert werden): „Küchenkarte / Trattoria"** — warmes Rezeptkarten-Papier, kräftiges Tomatenrot als Signaturfarbe, charaktervolle Serif für Überschriften. Kein generischer SaaS-Look, keine kalten Graustufen. Es soll sich anfühlen wie eine abgegriffene, geliebte Rezeptsammlung — nicht wie eine Enterprise-App.

**Farb-Token (Startpalette, anpassbar):**
- Papier / Hintergrund: `#F3ECDE`
- Karte: `#FBF7EE`
- Tinte / Text: `#2B2622`
- Gedämpfter Text: `#6B6154`
- Tomate (Signatur/Akzent): `#C0392B` · dunkler `#9E2C20`
- Basilikum (Sekundäraktion/positiv): `#4E6E52`
- Ocker (Highlight): `#C99A3B`
- Haarlinie: `#D8CBB0`

**Typografie:** Serif-Display für Titel und Überschriften (charaktervoll, mit Zurückhaltung eingesetzt), serifenlose Body-Schrift für alles Funktionale. Klare Typo-Skala.

**Signature-Element:** Die Rezeptkarte selbst — sie soll wie eine physische Karteikarte wirken (feiner Rand, dezenter Schlagschatten, das Foto oben, Titel in Serif).

**Mobile-first Pflicht:** Grosse Touch-Ziele (min. 44px), Daumen-erreichbare Primäraktionen, funktioniert einhändig, respektiert `prefers-reduced-motion`, sichtbarer Keyboard-Fokus. Tab-Navigation unten (nicht oben), weil Daumen.

---

## 3. Navigation — 4 Tabs

Untere Tab-Leiste, immer sichtbar:

1. **Rezepte** — meine gespeicherten Rezepte (Startbildschirm)
2. **Zutaten** — die Zutaten-Bibliothek
3. **Was koch ich?** — KI-Rezeptvorschlag aus vorhandenen Lebensmitteln
4. **Merkliste** — Longlist zum Ausprobieren

---

## 4. Screens & Funktionen im Detail

### Tab 1 — Rezepte

**Listenansicht (Startscreen)**
- Grid/Liste von Rezeptkarten. Jede Karte zeigt: Foto (oder „Kein Foto"-Platzhalter), Titel (Serif), kurze Zutatenzeile, kompakte Nährwertzeile (`X kcal · Yg E · Zg F · Wg KH`).
- Prominenter Primärbutton: **„Neues Rezept"** (Daumen-erreichbar, z.B. Floating Action Button unten rechts).
- Optional: Suchfeld oben zum Filtern nach Titel/Zutat.
- Leerzustand: freundliche Einladung, das erste Rezept anzulegen.

**Detail-/Bearbeiten-Ansicht** (ein Formular für Neu + Bearbeiten)
- **Titel** (Textfeld)
- **Zubereitung / Notizen** (mehrzeilig)
- **Foto vom Gericht** — Upload-Feld, das am iPhone direkt die **Kamera** öffnen kann (`capture="environment"`). Vorschau des Bildes mit „Bild entfernen". Beim Bearbeiten ersetzt ein neues Foto das alte.
- **Zutatenliste** — beliebig viele Zeilen, jede mit:
  - Bezeichnung (mit **Autocomplete** aus der Zutaten-Bibliothek — Auswahl übernimmt Link, Screenshot & Nährwerte)
  - Menge (frei, z.B. „3 Stk", „200 g")
  - Produktlink (Coop / Migros) — optional
  - Screenshot der Nährwerttabelle — optional, Upload
  - „✕ Zutat" zum Entfernen
  - „+ Zutat" zum Hinzufügen
- **„Nährwerte berechnen"** — schickt Zutaten (Screenshots als Bild, Rest als Text) an die KI; Ergebnis: Gesamt-kcal/E/F/KH + Aufschlüsselung pro Zutat + Genauigkeitshinweis.
- **Portionen** (Zahl) — Nährwerte zusätzlich pro Portion anzeigen.
- Aktionen: **Speichern**, **Abbrechen**, (im Edit) **Löschen**.

**States:** leer / gefüllt / lädt (Nährwertberechnung) / Fehler (KI nicht erreichbar → freundliche Meldung, Rezept bleibt trotzdem speicherbar).

### Tab 2 — Zutaten (Bibliothek)

- Baut sich **automatisch** auf: jede in einem Rezept genutzte Zutat wird gespeichert (Bezeichnung, Link, Screenshot, Nährwerte). Zusammenführung nach Name, keine Dubletten.
- Liste mit Suchfeld. Jeder Eintrag: Screenshot-Thumbnail, Bezeichnung (Serif), Nährwertzeile, Link.
- Einträge einzeln löschbar; idealerweise auch manuell editierbar.
- Leerzustand: Hinweis, dass die Bibliothek sich beim Anlegen von Rezepten von selbst füllt.

> **Nährwert-Normierung (wichtig für Claude Code):** Zutaten-Nährwerte sollten intern **pro 100 g / pro Stück** gespeichert und mit der Rezeptmenge hochgerechnet werden — nicht die rohe Menge aus einem Einzelrezept. So stimmt die Wiederverwendung bei anderer Menge.

### Tab 3 — Was koch ich?

- Textfeld: vorhandene Lebensmittel eingeben.
- Button **„Rezept vorschlagen"** → KI liefert EIN konkretes Rezept (Name, Zutaten, Zubereitung) + wenige Ergänzungen für eine ausgewogene Mahlzeit.
- Ergebnis als lesbare Karte. Nice-to-have: „In meine Rezepte übernehmen".
- States: leer / lädt / Fehler.

### Tab 4 — Merkliste (Longlist)

- Einträge hinzufügen aus: Notiz/Rezeptname, Video- oder Bildlink, oder Bild-Upload.
- Videolinks (YouTube/Vimeo/TikTok/Instagram) als Video erkennen und als anklickbaren Link zeigen; Bildlinks/-uploads als Vorschau.
- Abhaken (erledigt = durchgestrichen/gedimmt), löschen.
- Leerzustand.

---

## 5. Datenmodell (für Claude Code / Supabase)

**Tabelle `recipes`**
- `id` (uuid, pk) · `user_id` (uuid, fk auth.users) · `title` (text) · `body` (text) · `image_path` (text, Storage-Pfad) · `servings` (int) · `nutri` (jsonb: total + per_ingredient + note) · `created_at`, `updated_at`

**Tabelle `recipe_ingredients`** (oder als jsonb-Array im Rezept — Claude Code entscheidet nach Einfachheit)
- `id` · `recipe_id` (fk) · `name` · `amount` · `url` · `shot_path` (Storage) · `sort_order`

**Tabelle `ingredients`** (Bibliothek)
- `id` (uuid, pk) · `user_id` · `name` (text, unique je user) · `url` · `shot_path` · `nutri_per_100g` (jsonb: kcal/protein_g/fat_g/carbs_g) · `basis` (text: „100 g" / „Stück") · `updated_at`

**Tabelle `longlist`**
- `id` · `user_id` · `note` · `url` · `image_path` · `done` (bool) · `created_at`

**Storage-Buckets:** `recipe-photos`, `ingredient-shots`, `longlist-images` (oder ein Bucket mit Präfixen). Bilder **nicht** als Base64 in der DB — als Dateien in Supabase Storage, DB speichert nur den Pfad.

**Row Level Security:** an, alle Policies auf `user_id = auth.uid()`.

---

## 6. Technische Leitplanken (Claude Code)

- **KI-Calls (Nährwerte, „Was koch ich?") laufen serverseitig** über eine Next.js Route Handler / Server Action — der Anthropic-API-Key liegt in einer Env-Variable auf Vercel, **niemals im Browser**. (Im Artefakt lief das im Client; das wird hier bewusst umgestellt.)
- **Modellwahl:** Für Nährwert-/Vorschlag-Calls reicht ein günstiges Modell (Haiku-Klasse) — spart Kosten. Sonnet nur, wenn Qualität es verlangt.
- **PWA:** `manifest.json` (Name, Icon, `display: standalone`, Theme-Farbe = Tomatenrot), Apple-Touch-Icon, Service Worker fürs Home-Screen-Verhalten. Ziel: „Zum Home-Bildschirm" ergibt ein App-Icon im Vollbild.
- **Kamera-Upload:** `<input type="file" accept="image/*" capture="environment">`. Bilder vor Upload clientseitig komprimieren (z.B. auf max. ~1600px Kante), damit Storage und Ladezeit schlank bleiben.
- **Auth:** Supabase Auth (Magic Link genügt für Single-User). Alles an `user_id` gebunden → auf jedem Gerät gleich.
- **Kostenrahmen:** Supabase Free Tier + Vercel Hobby = CHF 0. Einzige variable Kosten = Anthropic-API (Rappen-Bereich). *Hinweis:* Supabase Free pausiert nach 7 Tagen Inaktivität — durch normale Nutzung oder einen wöchentlichen Ping wach halten.

---

## 7. Was aus dem Prototyp direkt übernommen wird

Die im Claude-Artefakt bereits funktionierende Logik dient als Referenz: Formularaufbau, Zutaten-Autocomplete, Nährwert-Prompt (JSON-Antwort mit `total` / `per_ingredient` / `note`, Screenshots als Bild-Input), Merklisten-Verhalten, Küchenkarten-Styling. Neu/anders in der Produktionsversion: echte Datenbank & Storage statt Artefakt-Storage, serverseitige API-Calls, Auth, PWA, Nährwert-Normierung pro 100 g.

---

## 8. Reihenfolge

1. **Claude Design:** Mobile-Screens für alle 4 Tabs + Detail-/Edit-Ansicht auf Basis dieses Briefs. Fokus: Look & Feel, Touch-Ergonomie, Küchenkarten-Signatur. Ergebnis = visuelle Referenz (Tailwind/shadcn-nah).
2. **Claude Code:** Next.js-Projekt nach dieser Spec, Design als Vorlage. Supabase-Schema + Storage + RLS, serverseitige KI-Routen, PWA-Setup, Deployment auf Vercel.
