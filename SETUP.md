# mise — implementation notes

Next.js 15 (App Router) + TypeScript + Tailwind v4, implementing
`project/My Little Kitchen v2.dc.html` ("Silber, Glas, Licht").

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY
npm run dev                    # http://localhost:3001
```

`dev` binds to `0.0.0.0`, so a phone on the same Wi-Fi can reach it at
`http://<your-mac-ip>:3001` — useful for testing on the real device. Note that
iOS will not register a service worker over plain HTTP, so "Zum Home-Bildschirm"
from a LAN address gives a standalone app without offline caching. The Pages
deployment is HTTPS and does not have that limitation.

Port 3001 for both `dev` and `start`. localStorage is scoped per origin
*including the port*, so data saved under `:3000` is not visible under `:3001`,
and neither is visible to the deployed site. Each is its own collection.

The app runs without a key — everything except the two AI actions works, and
those render the design's "nicht erreichbar" card.

## Deployment — two build shapes

The same codebase builds two ways, because GitHub Pages is a static file host
and cannot run server code.

| | `npm run build` | GitHub Actions → Pages |
|---|---|---|
| Runs on | Node (Vercel, a VPS, locally) | github.io, static files only |
| API routes | live | **removed at build time** |
| Nutrition | table + model top-up for unknowns | table only |
| Base path | `/` | `/mise/` |

**Live at https://alexkw94.github.io/mise/**, rebuilt by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push to
`main`.

### Nutrition without a server

The built-in table in [`src/lib/foodTable.ts`](src/lib/foodTable.ts) (≈200
common ingredients, per 100 g) is the primary source everywhere — not a
fallback. "Nährwerte berechnen" computes from it first, instantly, in every
build. Only ingredients the table does not know are sent to the model, and only
where a server exists.

This came out of checking what is actually reachable from a static site:

| Source | From the browser |
|---|---|
| Migros product page | blocked (no CORS) |
| Coop product page | 403 |
| Open Food Facts search API | blocked (no CORS) |
| Open Food Facts main API | blocked, and returning 503 at the time |

So there is **no free way to read nutrition from a product link or an online
database in the browser** — every one of them needs a server to proxy the
request. Open Food Facts was also a poor candidate on quality: a search for
"Griechischer Joghurt" returned three entries at 52, 70 and 114 kcal, one
claiming 35 g of carbohydrate. Crowdsourced and partly wrong.

Hence the built-in table: free, offline, instant, no key, no rate limit, no
third-party outage. Values are typical reference figures for the raw
ingredient, not brand-specific, so a given product can differ by 10–15%. A
value the user enters or corrects is stored in their own library and wins over
the table from then on.

**The product-link field was removed** from the ingredient row. It never fed
the calculation — nothing read it — and it cannot, for the CORS reason above.
Leaving a field that looks like it does something is worse than not having it.
Links already stored on seed ingredients still show in the Zutaten tab, where
they are honestly just bookmarks. `Ingredient.url` remains in the type, so
nothing was lost and the field can come back.

**The nutrition-table screenshot upload was removed** for the same reason: it
was input for the model, and the deployed build has no model.

Matching is deliberately forgiving — plural and singular ("Zwiebeln" →
"Zwiebel"), Swiss and German synonyms ("Rüebli" → "Karotten", "Nudeln" →
"Pasta"), and the longest whole-word match inside a longer name, so
"Pouletbrust vom Metzger" still resolves. Entries carry an optional piece
weight, which is what makes "2 Stk Zwiebel" (220 g) and "500 g Zwiebeln" both
correct.

When an amount cannot be read, or a name is unknown, the row says which of the
two it is rather than quietly contributing zero — that ambiguity was the
original complaint.

### What the static build gives up

`output: export` refuses to build POST route handlers, so the workflow deletes
`src/app/api` before building. The files stay in the repository — local
development and any Node deployment still have them.

What is lost on Pages is only the model top-up for ingredients missing from the
table. To get it back, deploy the Node build somewhere (Vercel Hobby is free);
the code needs no changes.

### Things that had to become base-path aware

Next rewrites its own asset URLs, but not URLs the app builds itself. These are
handled via `BASE_PATH` in [`src/lib/basePath.ts`](src/lib/basePath.ts):

- the service worker registration, and the worker's own precache list (it
  derives its base from `self.location`, so one file works at `/` and `/mise/`)
- the icon and manifest links in `metadata`
- **share links** — a link built on Pages has to point back into `/mise/`
- the manifest's own `start_url`, `scope` and icon paths are relative, so they
  resolve correctly at either location

`out/.nojekyll` is created by the workflow; without it GitHub's Jekyll step
drops every path beginning with an underscore, which is all of `/_next/`.

## What lives where

| Path | Role |
|---|---|
| `src/app/globals.css` | Design tokens, transcribed verbatim from the prototype |
| `src/components/` | The four tabs, the recipe editor, the tab bar |
| `src/lib/store.ts` | State + localStorage. The only module that touches persistence |
| `src/lib/idb.ts` | Image blobs in IndexedDB |
| `src/lib/nutrition.ts` | Per-100 g → recipe-amount scaling |
| `src/app/api/*` | Server-side Claude calls |
| `project/` | The original design bundle, kept as reference. Not compiled |

## "Was koch ich?" — switched off, not removed

The AI suggestion tab is disabled via `FEATURES.cookTab` in
[`src/lib/features.ts`](src/lib/features.ts). It is **off**, not deleted: the
tab disappears from the tab bar and the screen never mounts, but every piece
still exists and still compiles.

Still in the repository, untouched:

| File | What it is |
|---|---|
| `src/components/CookTab.tsx` | The screen: input, pantry chips, loading card, result card |
| `src/app/api/suggest/route.ts` | Server-side Claude call, structured output |
| `PANTRY_CHIPS` in `src/lib/seed.ts` | The quick-add chips |
| `adoptSuggestion` in `AppShell.tsx` | "In meine Rezepte übernehmen" |
| `CookResult` in `src/lib/types.ts` | The result shape |

**To bring it back:** set `cookTab: true`. The tab bar goes from three columns
to four on its own (it sizes to the number of enabled tabs), the screen mounts,
and adopting a suggestion opens the editor prefilled. Nothing else to touch.

## Brand

The app is **mise**, after *mise en place*. Source artwork lives in `logo/`
(wordmark and icon, each light and dark).

**In the app**, the wordmark is not the SVG — it is
[`src/components/Logo.tsx`](src/components/Logo.tsx), which renders "mise" as
real text plus a CSS dot. Three reasons: the logo's own spec asks for the
system sans the app already uses, live text stays crisp at every size and
pixel density, and the mark inherits `currentColor` so one component covers
light and dark ground. Proportions come straight from the SVG and are
expressed in `em` — dot diameter 0.222em (r=20 at font-size 180), gap 0.11em,
dot centred on the baseline — so it holds together at any size.

Placement:
- **Every main screen header** — `ScreenHeader` renders a brand row: wordmark
  left, the screen's kicker ("Meine Sammlung", "Baut sich selbst auf", …)
  right on the same line. Sharing the line means branding costs no extra
  height and no copy was given up for it.
- **Import sheet** — a share link is often someone's first contact with the
  app, so that one sheet introduces it by name (`Sheet`'s `brand` prop).

Sizing was set against the 34px screen title: at 19px the mark receded into
the kicker line, and at 24px it started competing with the title. 22px sits
clearly above the meta text and clearly below the heading. The dot carries a
small drop shadow so it reads as a silver sphere rather than a grey speck at
interface sizes.

**Icons** are generated from the mark by `npm run icons`
([`scripts/gen-icons.mjs`](scripts/gen-icons.mjs)), rasterised through headless
Chrome so they use the same system sans rather than a bundled font. Set
`CHROME_PATH` if Chrome is not at the macOS default location. Three variants,
because the platforms want different things:

| File | Shape | Why |
|---|---|---|
| `icon-192/512.png` | rounded, transparent outside | how it appears in a tab or task switcher |
| `apple-touch-icon.png` | square, opaque | iOS applies its own squircle mask; baked corners leave pale slivers under it, and iOS composites transparency onto black |
| `icon-maskable-512.png` | square, opaque, mark at 72% | Android may crop to a circle, so it must fill the canvas |

The silver dot is the same gradient family as `--plate`, which is why the mark
sits naturally on the app's brushed-silver surfaces.

## Categories

A category is just a string on a recipe (`Recipe.categories`). There is no
separate list to maintain: `deriveCategories()` reads them off the recipes,
ordered by how often each is used, and a category stops existing when the last
recipe drops it.

- **Tagging**: `CategoryField` in the editor — categories already in use, then
  suggestions from `SUGGESTED_CATEGORIES`, then free text via "+ Neu".
- **Filtering**: the chip row under the search field on the recipes tab.
  Creating a recipe while a filter is active pre-tags it with that category.
- **On cards**: shown as the kicker line above the title.

## Sharing

Pragmatic and backend-free. A share produces **plain text plus a link**:

- **Text** — title, portions, categories, ingredients with amounts,
  preparation, nutrition. Readable in WhatsApp, Mail, Signal, anywhere.
- **Link** — `/?r=<base64url>` carrying the recipes *inside the URL*. Nothing
  is uploaded. A friend who opens it gets an import prompt; a friend who
  doesn't have the app still reads the text.

Delivery is the native share sheet (`navigator.share`, so the iPhone share
sheet) and clipboard where there isn't one. Entry points: **Rezept teilen** at
the bottom of the editor, and **Kategorie teilen** on the recipes tab when a
category filter is active.

Two deliberate limits:
- **Photos are not shared.** They live in the sender's IndexedDB; base64 images
  in a URL would be absurd. The import sheet says so.
- **Links over 8000 characters are dropped** and the text is shared alone —
  a very large category would otherwise produce an unusable URL.

Imports never apply silently: `ImportSheet` lists what arrived and waits for
confirmation, and the `?r=` parameter is cleared afterwards so a refresh
doesn't ask twice. Imported recipes come in with `nutri: null` on purpose —
values are recomputed against the recipient's own library.

## Typography

The prototype set a size per element, which left the editor with eight
near-identical sizes (11.5 / 12.5 / 13 / 13.5 / 14.5 / 15.5 …) and no readable
hierarchy — sizes differed without meaning anything. `globals.css` now defines
six steps, each with one job:

| Class | Size | Used for |
|---|---|---|
| `.mlk-t-display` | 30 | Screen title |
| `.mlk-t-total` | 34 | The one big number (kcal) |
| `.mlk-t-number` | 21 | Inline numeric value (portions) |
| `.mlk-t-label` | 15.5 / 500 | Anything you act on: field text, buttons, row labels |
| `.mlk-t-body` | 15.5 / 400 | Running text |
| `.mlk-t-sub` | 13.5 | Secondary fields, detail rows |
| `.mlk-t-meta` | 12.5 | Captions, counters, notes |
| `.mlk-kicker` | 10 | Section headings |

Rule of thumb: a field and its label are one step apart, never two. Prefer these
classes over an inline `fontSize` when touching the editor.

## Decisions worth knowing

**The iOS frame is gone, its intent is not.** `ios-frame.jsx` drew a dynamic
island, status bar, and home indicator — prototype scaffolding for a desktop
preview, not app UI. What it *implied* is real: the header's `58px` top padding
and the tab bar's `26px` bottom padding are now `env(safe-area-inset-*)`, with
`viewport-fit=cover` set so iOS reports real values.

**Tab-bar icons replace the placeholder squares.** The design's own "Nächste
Schritte" panel names this ("SF-Symbols-ähnliche Icons statt der Platzhalter").
The active/inactive colours and the glow are unchanged.

**`_ds/` (the "Modernist" design system in the bundle) is unused.** It is
0-radius red-on-white with 2px rules — the opposite of v2's glass. v2 uses no
class from it.

**shadcn/ui was skipped** despite the brief listing it. Every surface here is a
custom glass material; shadcn's components would have to be overridden into
unrecognisability. Tailwind is used for layout, `globals.css` for material.

**Custom CSS lives in `@layer components`.** Unlayered CSS beats *all* layered
CSS regardless of specificity, so unlayered `.mlk-input { width: 100% }` would
silently override `w-[98px]`. Keep new `.mlk-*` rules inside the layer.

**Nutrition is normalised per 100 g / per piece**, per the brief's note.
Values are scaled against the user's amounts locally, so the same "Olivenöl"
entry stays correct at 2 EL and at 500 g, and totals never drift from the
amounts on screen. See "Nutrition without a server" above.

**Portions were removed.** The stepper set a number that only fed a
"pro Portion" line, and it was not clear what it was for. `servings` is gone
from the type; the recipe card now shows the ingredient count where the
portions chip used to be.

**Images: IndexedDB, not the JSON.** localStorage caps around 5 MB; two phone
photos would exceed it. Records hold an id, which is the same shape a Supabase
Storage path takes. Uploads are downscaled to a 1600px long edge and
re-encoded as JPEG before storage (~4 MB → ~300 KB).

## Model choice

`claude-haiku-4-5`, per the brief's cost guidance, overridable with
`ANTHROPIC_MODEL`. Both routes use structured outputs, so responses are
schema-valid JSON rather than parsed prose. Bump to `claude-sonnet-5` if
nutrition estimates from screenshots feel weak.

## Not done — deliberately

- **Supabase.** Per your choice, persistence is local-first. `src/lib/store.ts`
  and `src/lib/idb.ts` are the seams; the component tree never touches storage.
  The brief's schema (`recipes`, `recipe_ingredients`, `ingredients`,
  `longlist` + three Storage buckets + RLS on `user_id`) maps onto the types in
  `src/lib/types.ts` without reshaping them.
- **Auth.** Single-user, no login. Arrives with Supabase.
- **The AI routes have not been run against the live API** — no key was
  available in this environment. Request shape, schema, and error handling are
  typechecked against the SDK, and the failure paths were exercised (400 on bad
  input, 503 → the design's error card). The first call with a real key is
  still the first real call.

## Known issue

`npm audit` reports 3 high-severity advisories, all inside Next 15's bundled
`postcss` and `sharp`. Both are build-time here (no attacker-controlled CSS, and
`next/image` is never pointed at remote content). The fix is Next 16, a major
upgrade — worth doing, but as its own change rather than folded into this one.
