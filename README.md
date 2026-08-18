# mise

Eine persönliche Kochapp fürs iPhone. *mise en place* — alles am Platz.

**→ [alexkw94.github.io/mise](https://alexkw94.github.io/mise/)**
Im iPhone-Safari öffnen, dann Teilen → „Zum Home-Bildschirm".

## Was sie kann

- **Rezepte** mit Foto, Zutaten, Mengen, Produktlinks und Nährwerten
- **Kategorien** (High-Protein, Breakfast, Vegan …) zum Filtern
- **Teilen** von einzelnen Rezepten oder ganzen Kategorien — als Text plus
  Link, ohne Server, ohne Konto
- **Zutaten-Bibliothek**, die sich aus den Rezepten selbst aufbaut; Nährwerte
  liegen pro 100 g / Stück und werden auf die jeweilige Menge hochgerechnet
- **Merkliste** für Videolinks, Screenshots und Ideen

Alle Daten bleiben auf dem Gerät (localStorage + IndexedDB für Bilder).

## Entwickeln

```bash
npm install
npm run dev          # http://localhost:3001, auch im LAN erreichbar
```

Für die KI-Nährwertschätzung zusätzlich:

```bash
cp .env.example .env.local   # ANTHROPIC_API_KEY eintragen
```

## Zwei Build-Formen

| Build | Wo | KI-Nährwerte |
|---|---|---|
| `npm run build` | Node/Vercel | ja, serverseitig über `/api/nutrition` |
| GitHub Actions → Pages | github.io | nein — Pages kann keinen Servercode ausführen; die App rechnet aus der Bibliothek |

Details und Designentscheidungen: **[SETUP.md](SETUP.md)**.
Die ursprüngliche Design-Vorlage liegt in [`project/`](project/), das
Handoff-Dokument dazu in [HANDOFF.md](HANDOFF.md).
