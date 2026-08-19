# Sync einrichten (Supabase, mitbenutztes Projekt)

mise legt nur eigene Tabellen mit `mise_`-Präfix an. Ein bestehendes Projekt
wird dadurch nicht verändert — es teilt sich lediglich Datenbank und
Benutzerverwaltung.

## 1. Schema anlegen

Supabase-Dashboard → **SQL Editor** → *New query* → Inhalt von
[`001_mise_schema.sql`](001_mise_schema.sql) einfügen → **Run**.

Legt drei Tabellen an (`mise_recipes`, `mise_longlist`, `mise_library`),
Indizes und die Row-Level-Security-Policies. Bestehendes wird nicht angefasst.

## 2. Schlüssel heraussuchen

**Project Settings → API**:

| Wert | Wofür |
|---|---|
| Project URL | `https://<ref>.supabase.co` |
| `anon` `public` key | darf öffentlich sein — geschützt wird über RLS |

Der `service_role`-Key wird **nicht** gebraucht und darf niemals in die App.
Er umgeht RLS.

## 3. E-Mail-Login erlauben

**Authentication → Providers → Email** aktiviert lassen. Der Login läuft über
einen Magic Link, es gibt kein Passwort.

**Authentication → URL Configuration**: unter *Redirect URLs* eintragen:

```
https://alexkw94.github.io/mise/
http://localhost:3001/
```

Ohne diese Einträge landet der Link ins Leere.

## 4. Nach dem ersten Login: Registrierung schliessen

Weil das Repo öffentlich ist, kann jeder den Anon-Key lesen und sich sonst ein
Konto in deinem Projekt anlegen. Deine Daten sieht dabei niemand — dafür sorgt
RLS — aber es geht auf dein Kontingent.

Deshalb: **zuerst auf iPhone und MacBook je einmal einloggen**, danach
**Authentication → Providers → Email → „Allow new users to sign up"**
abschalten. Bestehende Anmeldungen funktionieren weiter.

## 5. Schlüssel in den Build geben

Als **Repository variables** (nicht Secrets — sie stehen ohnehin im
ausgelieferten JavaScript, und Secrets wären in den Build-Logs nur unnötig
maskiert):

GitHub → Repo → Settings → Secrets and variables → Actions → *Variables*:

| Name | Wert |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | die Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | der anon-Key |

Lokal dieselben zwei Zeilen in `.env.local`.

Fehlen die Werte, läuft die App genau wie bisher rein lokal — Sync erscheint
dann gar nicht erst.

## Was synchronisiert wird

| | |
|---|---|
| Rezepte, Kategorien, Zutaten, Mengen | ja |
| Selbst eingetragene Nährwerte | ja |
| Merkliste | ja |
| **Fotos und Screenshots** | **nein, bleiben lokal** |

Bilder sind der mit Abstand grösste Teil der Daten und der am wenigsten
kritische. Sie liegen weiterhin im Gerätespeicher; die Sicherungsdatei
überträgt sie, wenn du sie brauchst.

Gelöschtes wird als Tombstone übertragen (`deleted_at`), sonst würde ein auf
einem Gerät gelöschtes Rezept beim nächsten Abgleich vom anderen Gerät
zurückkommen.
