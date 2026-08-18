"use client";

import { useMemo, useRef, useState } from "react";
import { StoredImage } from "./StoredImage";
import { TABBAR } from "./Screen";
import { IngredientPicker } from "./IngredientPicker";
import { CategoryField } from "./CategoryField";
import { computeNutrition, macroLine, nutriLine } from "@/lib/nutrition";
import { makeLookup, actions, useStore } from "@/lib/store";
import { blobToBase64, storeImageFile } from "@/lib/image";
import { deleteImage, getImage } from "@/lib/idb";
import { shareRecipes, type ShareOutcome } from "@/lib/share";
import { IS_STATIC } from "@/lib/basePath";
import type {
  Basis,
  Ingredient,
  LibraryEntry,
  NutriPer,
  Recipe,
} from "@/lib/types";

interface EstimatedIngredient {
  name: string;
  basis: Basis;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export function RecipeEditor({
  draft: initial,
  isNew,
  library,
  knownCategories,
  onCancel,
  onSave,
  onDelete,
}: {
  draft: Recipe;
  isNew: boolean;
  library: LibraryEntry[];
  knownCategories: string[];
  onCancel: () => void;
  onSave: (r: Recipe) => void;
  onDelete: (id: string) => void;
}) {
  const state = useStore();
  const [draft, setDraft] = useState<Recipe>(initial);
  const [sugRow, setSugRow] = useState<number | null>(null);
  const [calcState, setCalcState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const shotRef = useRef<HTMLInputElement>(null);
  const shotRowRef = useRef<number>(0);

  const patch = (fn: (d: Recipe) => void) =>
    setDraft((d) => {
      const next = structuredClone(d);
      fn(next);
      return next;
    });

  const patchIng = (i: number, key: keyof Ingredient, value: string | null) =>
    patch((d) => {
      // @ts-expect-error -- key is constrained to Ingredient's own fields
      d.ings[i][key] = value;
    });

  /* ---------------------------------------------------------------- photos */

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const id = await storeImageFile(file, "photo");
    if (draft.photoId) void deleteImage(draft.photoId);
    patch((d) => {
      d.photoId = id;
    });
  }

  function clearPhoto() {
    if (draft.photoId) void deleteImage(draft.photoId);
    patch((d) => {
      d.photoId = null;
    });
  }

  async function onShot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const row = shotRowRef.current;
    e.target.value = "";
    if (!file) return;
    const id = await storeImageFile(file, "shot");
    const old = draft.ings[row]?.shotId;
    if (old) void deleteImage(old);
    patchIng(row, "shotId", id);
  }

  /* ------------------------------------------------------------ ingredients */

  /** Adds library picks as rows, replacing a trailing empty row if there is one. */
  function addFromLibrary(entries: LibraryEntry[]) {
    patch((d) => {
      const last = d.ings[d.ings.length - 1];
      if (last && !last.name.trim() && !last.amount.trim()) d.ings.pop();
      for (const e of entries) {
        d.ings.push({
          name: e.name,
          amount: "",
          url: e.url,
          shotId: e.shotId,
        });
      }
    });
  }

  /* ----------------------------------------------------------- nutrition */

  async function calcNutrition() {
    if (calcState === "loading") return;
    const ings = draft.ings.filter((i) => i.name.trim());
    if (ings.length === 0) return;

    setCalcState("loading");

    // Static build (GitHub Pages): there is no server to ask, so compute from
    // the library alone. Everything the library knows is exact; what it does
    // not know stays open, and the note says so rather than pretending.
    if (IS_STATIC) {
      const nutri = computeNutrition(draft.ings, makeLookup(state));
      const unknown = nutri.per.filter((x) => x.kcal === null).length;
      patch((d) => {
        d.nutri = {
          ...nutri,
          note: unknown
            ? `${nutri.note} Die KI-Schätzung für unbekannte Zutaten gibt es nur in der Server-Version.`
            : nutri.note,
        };
      });
      setCalcState("idle");
      return;
    }

    try {
      const payload = await Promise.all(
        ings.map(async (i) => {
          if (!i.shotId) return { name: i.name, amount: i.amount };
          const blob = await getImage(i.shotId).catch(() => undefined);
          if (!blob) return { name: i.name, amount: i.amount };
          return { name: i.name, amount: i.amount, shot: await blobToBase64(blob) };
        }),
      );

      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: payload }),
      });
      if (!res.ok) throw new Error(String(res.status));

      const data = (await res.json()) as {
        ingredients: EstimatedIngredient[];
        note: string;
      };

      // Persist per-100 g values to the library so every other recipe that
      // uses the same ingredient gets them too, then compute totals locally
      // from the user's amounts.
      const fresh = new Map<string, { basis: Basis; nutriPer100: NutriPer }>();
      for (const e of data.ingredients) {
        const value = {
          basis: e.basis,
          nutriPer100: {
            kcal: Math.round(e.kcal),
            p: Math.round(e.protein_g * 10) / 10,
            f: Math.round(e.fat_g * 10) / 10,
            c: Math.round(e.carbs_g * 10) / 10,
          },
        };
        fresh.set(e.name, value);
        actions.setLibraryNutrition(e.name, value.basis, value.nutriPer100);
      }

      const base = makeLookup(state);
      const nutri = computeNutrition(draft.ings, (n) => fresh.get(n) ?? base(n));
      patch((d) => {
        d.nutri = { ...nutri, note: data.note || nutri.note };
      });
      setCalcState("idle");
    } catch {
      setCalcState("error");
    }
  }

  /* ---------------------------------------------------------------- share */

  async function share() {
    const outcome: ShareOutcome = await shareRecipes([draft], null);
    if (outcome === "cancelled") return;
    setShareNote(
      outcome === "shared"
        ? "Geteilt."
        : outcome === "copied"
          ? "In die Zwischenablage kopiert."
          : "Teilen hat nicht geklappt.",
    );
    setTimeout(() => setShareNote(null), 2600);
  }

  /* ------------------------------------------------------------ derived */

  const perServing =
    draft.nutri && draft.servings
      ? Math.round(draft.nutri.kcal / draft.servings)
      : null;

  const suggestionsFor = useMemo(
    () => (i: number) => {
      const term = (draft.ings[i]?.name ?? "").trim().toLowerCase();
      if (!term) return [];
      return library
        .filter(
          (x) =>
            x.name.toLowerCase().includes(term) &&
            x.name.toLowerCase() !== term,
        )
        .slice(0, 3);
    },
    [draft.ings, library],
  );

  function save() {
    onSave({
      ...draft,
      title: draft.title.trim() || "Ohne Titel",
      ings: draft.ings.filter((i) => i.name.trim()),
    });
  }

  /* -------------------------------------------------------------- render */

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden">
      <header
        className="flex flex-none items-center justify-between gap-2"
        style={{
          padding: "calc(var(--safe-top) + 20px) 16px 14px",
          background: "rgba(255,255,255,.7)",
          backdropFilter: "blur(28px) saturate(190%)",
          WebkitBackdropFilter: "blur(28px) saturate(190%)",
          borderBottom: "0.5px solid var(--hairline)",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="mlk-t-body flex h-11 cursor-pointer items-center px-2.5 hover:opacity-60"
          style={{ color: "var(--color-accent)" }}
        >
          Abbrechen
        </button>
        <span className="mlk-kicker" style={{ letterSpacing: "0.18em" }}>
          {isNew ? "Neues Rezept" : "Rezept bearbeiten"}
        </span>
        <button
          type="button"
          onClick={save}
          className="mlk-btn-primary mlk-t-label h-[42px] px-5"
          style={{ boxShadow: "0 8px 18px -10px rgba(0,0,0,.6)" }}
        >
          Speichern
        </button>
      </header>

      <div
        className="mlk-scroll min-h-0 flex-1 overflow-y-auto px-[22px] pt-[22px]"
        style={{ paddingBottom: `calc(${TABBAR} + 24px)` }}
      >
        <input
          value={draft.title}
          onChange={(e) => patch((d) => void (d.title = e.target.value))}
          placeholder="Titel des Gerichts"
          aria-label="Titel des Gerichts"
          className="mlk-t-display w-full border-none bg-transparent pb-3"
          style={{ borderBottom: "0.5px solid rgba(0,0,0,.12)" }}
        />

        {/* Photo — `capture` opens the rear camera straight away on iPhone. */}
        <div
          className="mlk-plate mt-[22px] flex h-[190px] flex-col items-start justify-end gap-2.5 p-4"
          style={{
            borderRadius: 22,
            border: "0.5px solid rgba(255,255,255,.9)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,.9), 0 10px 28px -16px rgba(20,22,28,.35)",
          }}
        >
          <StoredImage
            id={draft.photoId}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="relative mlk-chip" style={{ padding: "8px 12px" }}>
            {draft.photoId ? "Foto vom Gericht ✓" : "Noch kein Foto"}
          </span>
          <button
            type="button"
            onClick={() =>
              draft.photoId ? clearPhoto() : photoRef.current?.click()
            }
            className="mlk-btn-primary mlk-t-label relative"
            style={{
              padding: "13px 18px",
              boxShadow: "0 8px 18px -10px rgba(0,0,0,.6)",
            }}
          >
            {draft.photoId ? "Bild entfernen" : "Kamera öffnen"}
          </button>
        </div>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPhoto}
        />

        {/* ------------------------------------------------- categories */}

        <div className="mt-7">
          <div className="mlk-kicker">Kategorien</div>
          <CategoryField
            selected={draft.categories}
            known={knownCategories}
            onChange={(next) => patch((d) => void (d.categories = next))}
          />
        </div>

        {/* ------------------------------------------------ ingredients */}

        <div className="mt-7 flex items-baseline justify-between">
          <span className="mlk-kicker">Zutaten</span>
          <span className="mlk-t-meta">
            {draft.ings.length} {draft.ings.length === 1 ? "Zeile" : "Zeilen"}
          </span>
        </div>

        <div className="mt-3.5 flex flex-col gap-3">
          {draft.ings.map((row, i) => {
            const sug = sugRow === i ? suggestionsFor(i) : [];
            return (
              <div
                key={i}
                className="mlk-card p-3.5"
                style={{ borderRadius: 20 }}
              >
                <div className="flex gap-[9px]">
                  <input
                    value={row.name}
                    onChange={(e) => {
                      setSugRow(i);
                      patchIng(i, "name", e.target.value);
                    }}
                    onFocus={() => setSugRow(i)}
                    placeholder="Bezeichnung"
                    aria-label="Bezeichnung"
                    className="mlk-input min-w-0 flex-1"
                    style={{ background: "rgba(255,255,255,.8)" }}
                  />
                  <input
                    value={row.amount}
                    onChange={(e) => patchIng(i, "amount", e.target.value)}
                    placeholder="Menge"
                    aria-label="Menge"
                    className="mlk-input w-[98px] flex-none"
                    style={{ background: "rgba(255,255,255,.8)" }}
                  />
                </div>

                {sug.length > 0 && (
                  <div
                    className="mt-2.5 overflow-hidden"
                    style={{
                      borderRadius: 16,
                      background: "rgba(255,255,255,.92)",
                      border: "0.5px solid rgba(0,0,0,.1)",
                      boxShadow: "0 16px 34px -18px rgba(20,22,28,.45)",
                    }}
                  >
                    {sug.map((s) => (
                      <button
                        key={s.name}
                        type="button"
                        className="mlk-row-divider block w-full cursor-pointer px-3.5 py-3 text-left hover:bg-[rgba(0,113,227,.07)]"
                        onClick={() => {
                          patch((d) => {
                            d.ings[i].name = s.name;
                            if (!d.ings[i].url) d.ings[i].url = s.url;
                            if (!d.ings[i].shotId) d.ings[i].shotId = s.shotId;
                          });
                          setSugRow(null);
                        }}
                      >
                        <div className="mlk-t-label">{s.name}</div>
                        <div className="mlk-t-meta mt-1">{nutriLine(s)}</div>
                      </button>
                    ))}
                  </div>
                )}

                <input
                  value={row.url}
                  onChange={(e) => patchIng(i, "url", e.target.value)}
                  placeholder="Produktlink Coop / Migros"
                  aria-label="Produktlink"
                  inputMode="url"
                  className="mlk-input mlk-input-sub mt-[9px]"
                  style={{ background: "rgba(255,255,255,.8)" }}
                />

                <div className="mt-[9px] flex items-center gap-[9px]">
                  <button
                    type="button"
                    className="mlk-btn-dashed h-[42px] flex-1 px-3.5"
                    style={{
                      borderRadius: 14,
                      fontSize: "13.5px",
                      color: row.shotId
                        ? "var(--color-accent)"
                        : "var(--color-subtle)",
                    }}
                    onClick={() => {
                      shotRowRef.current = i;
                      shotRef.current?.click();
                    }}
                  >
                    {row.shotId
                      ? "Screenshot Nährwerte ✓"
                      : "Screenshot Nährwerttabelle"}
                  </button>
                  <button
                    type="button"
                    className="mlk-icon-btn"
                    aria-label="Zutat entfernen"
                    onClick={() => {
                      if (row.shotId) void deleteImage(row.shotId);
                      patch((d) => void d.ings.splice(i, 1));
                      setSugRow(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <input
          ref={shotRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onShot}
        />

        <div className="mt-3.5 flex gap-2.5">
          <button
            type="button"
            className="mlk-btn-primary mlk-t-label h-12 flex-1 justify-start px-[18px]"
            onClick={() => setPickerOpen(true)}
          >
            Aus Bibliothek
          </button>
          <button
            type="button"
            className="mlk-btn-secondary mlk-t-label h-12 flex-1 justify-start px-[18px]"
            onClick={() =>
              patch((d) =>
                void d.ings.push({ name: "", amount: "", url: "", shotId: null }),
              )
            }
          >
            + Leere Zeile
          </button>
        </div>

        {/* --------------------------------------------------- servings */}

        <div
          className="mt-7 flex items-center justify-between p-4"
          style={{
            borderRadius: 20,
            background: "rgba(255,255,255,.72)",
            border: "0.5px solid var(--glass-rim)",
            boxShadow: "0 1px 1px rgba(0,0,0,.04)",
          }}
        >
          <span className="mlk-t-label">Portionen</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="mlk-stepper"
              aria-label="Weniger Portionen"
              disabled={draft.servings <= 1}
              onClick={() =>
                patch((d) => void (d.servings = Math.max(1, d.servings - 1)))
              }
            >
              −
            </button>
            <span
              className="mlk-t-number w-[54px] text-center"
              aria-live="polite"
            >
              {draft.servings}
            </span>
            <button
              type="button"
              className="mlk-stepper"
              aria-label="Mehr Portionen"
              disabled={draft.servings >= 12}
              onClick={() =>
                patch((d) => void (d.servings = Math.min(12, d.servings + 1)))
              }
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={calcNutrition}
          disabled={calcState === "loading"}
          className="mlk-btn-secondary mlk-t-label mt-3 h-[54px] w-full justify-start px-5"
          style={{
            background:
              "linear-gradient(180deg,rgba(255,255,255,.95),rgba(240,241,244,.9))",
            border: "0.5px solid rgba(0,0,0,.12)",
            boxShadow: "0 6px 18px -12px rgba(20,22,28,.5)",
          }}
        >
          {calcState === "loading" ? "Rechnet …" : "Nährwerte berechnen"}
        </button>

        {draft.nutri && calcState !== "loading" && (
          <div className="mlk-card mt-4 overflow-hidden">
            <div
              className="p-[18px]"
              style={{ borderBottom: "0.5px solid rgba(0,0,0,.08)" }}
            >
              <div className="mlk-kicker">Nährwerte gesamt</div>
              {/* Wraps as a whole; the headline number never breaks mid-value. */}
              <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="mlk-t-total whitespace-nowrap">
                  {draft.nutri.kcal} kcal
                </span>
                <span className="mlk-t-sub" style={{ color: "var(--color-subtle)" }}>
                  {macroLine(draft.nutri)}
                </span>
              </div>
              {perServing !== null && (
                <div
                  className="mlk-t-sub mt-3"
                  style={{ color: "var(--color-accent)" }}
                >
                  Pro Portion {perServing} kcal bei {draft.servings} Portionen
                </div>
              )}
            </div>

            {draft.nutri.per.map((p) => (
              <div
                key={p.name}
                className="mlk-t-sub mlk-row-divider flex justify-between gap-2.5 px-[18px] py-3"
              >
                <span>{p.name}</span>
                <span
                  className="whitespace-nowrap"
                  style={{ color: "var(--color-subtle)" }}
                >
                  {p.kcal === null
                    ? "keine Werte"
                    : `${p.kcal} kcal · ${p.p}/${p.f}/${p.c} g`}
                </span>
              </div>
            ))}

            <p className="mlk-t-meta px-[18px] py-3.5">{draft.nutri.note}</p>
          </div>
        )}

        {calcState === "error" && (
          <div
            className="mlk-t-sub mt-4 p-4"
            role="alert"
            style={{
              borderRadius: 18,
              border: "0.5px solid rgba(0,0,0,.1)",
              background: "rgba(255,255,255,.8)",
              color: "var(--color-muted)",
            }}
          >
            Die Nährwert-Schätzung ist grad nicht erreichbar. Kein Drama — das
            Rezept lässt sich trotzdem speichern, die Werte holst du später
            nach.
          </div>
        )}

        <textarea
          value={draft.body}
          onChange={(e) => patch((d) => void (d.body = e.target.value))}
          placeholder="Zubereitung, Notizen, was du nächstes Mal anders machst"
          aria-label="Zubereitung und Notizen"
          className="mlk-textarea mt-7 min-h-[140px]"
          style={{ borderRadius: 20, lineHeight: 1.55 }}
        />

        <div className="mt-[22px] flex flex-col gap-2.5">
          <button
            type="button"
            onClick={share}
            className="mlk-btn-secondary mlk-t-label h-12 w-full justify-start px-[18px]"
          >
            Rezept teilen
          </button>

          {shareNote && (
            <p className="mlk-t-meta px-1" role="status">
              {shareNote}
            </p>
          )}

          {!isNew && (
            <button
              type="button"
              onClick={() => onDelete(draft.id)}
              className="mlk-t-label flex h-12 w-full cursor-pointer items-center px-[18px]"
              style={{
                borderRadius: 100,
                border: "0.5px solid rgba(0,0,0,.12)",
                background: "rgba(255,255,255,.7)",
                color: "var(--color-danger)",
              }}
            >
              Rezept löschen
            </button>
          )}
        </div>
      </div>

      {pickerOpen && (
        <IngredientPicker
          library={library}
          alreadyUsed={draft.ings.map((i) => i.name)}
          onAdd={addFromLibrary}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </main>
  );
}
