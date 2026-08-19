"use client";

import { useMemo, useRef, useState } from "react";
import { StoredImage } from "./StoredImage";
import { TABBAR } from "./Screen";
import { IngredientPicker } from "./IngredientPicker";
import { CategoryField } from "./CategoryField";
import { NutritionSheet } from "./NutritionSheet";
import {
  UNIT_HINT,
  computeNutrition,
  macroLine,
  nutriLine,
  type NutriSource,
} from "@/lib/nutrition";
import { makeLookup, actions, useStore } from "@/lib/store";
import { blobToBase64, storeImageFile } from "@/lib/image";
import { deleteImage, getImage } from "@/lib/idb";
import { shareRecipes, type ShareOutcome } from "@/lib/share";
import { IS_STATIC } from "@/lib/basePath";
import { useUploadThing } from "@/lib/uploadthing";
import { compressImage } from "@/lib/image";
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
  const [missing, setMissing] = useState<string[]>([]);
  const [editingNutri, setEditingNutri] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);

  const { startUpload } = useUploadThing("recipePhoto");
  const [shareNote, setShareNote] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // Same resolution the calculation uses, so the hint under a row and the
  // final number can never disagree.
  const lookup = useMemo(() => makeLookup(state), [state]);

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

  /**
   * Compress, then upload. The hosted URL is what makes a photo appear on the
   * other device, because it travels inside the recipe.
   *
   * If the upload fails — offline, no server, quota — the compressed photo is
   * still kept locally rather than dropped. Better a photo that exists on one
   * device than a lost one.
   */
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPhotoBusy(true);
    setPhotoNote(null);
    const previousId = draft.photoId;

    try {
      const compressed = await compressImage(file);
      const named = new File([compressed], "foto.jpg", { type: "image/jpeg" });

      // Local copy first: it shows immediately and survives a failed upload.
      const id = await storeImageFile(named, "photo");
      patch((d) => {
        d.photoId = id;
        d.photoUrl = null;
      });
      if (previousId) void deleteImage(previousId);

      if (IS_STATIC) {
        setPhotoNote("Bleibt auf diesem Gerät — diese Version hat keinen Upload.");
        return;
      }

      const res = await startUpload([named]);
      const url = res?.[0]?.serverData?.url ?? res?.[0]?.ufsUrl;
      if (!url) throw new Error("keine URL");

      patch((d) => {
        d.photoUrl = url;
      });
    } catch {
      setPhotoNote(
        "Hochladen hat nicht geklappt — das Foto ist gespeichert, aber vorerst nur hier.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function clearPhoto() {
    if (draft.photoId) void deleteImage(draft.photoId);
    setPhotoNote(null);
    patch((d) => {
      d.photoId = null;
      d.photoUrl = null;
    });
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
    const named = draft.ings.filter((i) => i.name.trim());
    if (named.length === 0) return;

    // 1. Always compute from the built-in table first. It is instant, free and
    //    works in every build — the result is on screen before any request.
    const base = makeLookup(state);
    const local = computeNutrition(draft.ings, base);
    patch((d) => {
      d.nutri = local;
    });

    const unknown = local.per
      .filter((row) => row.reason === "unknown")
      .map((row) => row.name);

    // 2. Nothing the table could not answer, or no server to ask: done.
    if (unknown.length === 0 || IS_STATIC) {
      setCalcState("idle");
      return;
    }

    // 3. Only the leftovers go to the model, and only where a server exists.
    setCalcState("loading");
    try {
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: named
            .filter((i) => unknown.includes(i.name))
            .map((i) => ({ name: i.name, amount: i.amount })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));

      const data = (await res.json()) as {
        ingredients: EstimatedIngredient[];
        note: string;
      };

      // Per-100 g values go into the library, so every other recipe using the
      // same ingredient gets them too; totals stay a local computation.
      const fresh = new Map<string, NutriSource>();
      for (const e of data.ingredients) {
        const value: NutriSource = {
          basis: e.basis,
          nutriPer100: {
            kcal: Math.round(e.kcal),
            p: Math.round(e.protein_g * 10) / 10,
            f: Math.round(e.fat_g * 10) / 10,
            c: Math.round(e.carbs_g * 10) / 10,
          },
          gramsPerPiece: null,
        };
        fresh.set(e.name, value);
        actions.setLibraryNutrition(e.name, value.basis, value.nutriPer100);
      }

      const merged = computeNutrition(
        draft.ings,
        (n) => fresh.get(n) ?? base(n),
      );
      patch((d) => {
        d.nutri = merged;
      });
      setCalcState("idle");
    } catch {
      // The local numbers stay on screen; only the top-up failed.
      setMissing(unknown);
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
            src={draft.photoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="relative mlk-chip" style={{ padding: "8px 12px" }}>
            {photoBusy
              ? "Lädt hoch …"
              : draft.photoUrl
                ? "Foto · auf allen Geräten"
                : draft.photoId
                  ? "Foto · nur hier"
                  : "Noch kein Foto"}
          </span>
          {draft.photoId ? (
            <button
              type="button"
              onClick={clearPhoto}
              className="mlk-btn-primary mlk-t-label relative"
              style={{
                padding: "13px 18px",
                boxShadow: "0 8px 18px -10px rgba(0,0,0,.6)",
              }}
            >
              Bild entfernen
            </button>
          ) : (
            <div className="relative flex gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="mlk-btn-primary mlk-t-label"
                style={{
                  padding: "13px 18px",
                  boxShadow: "0 8px 18px -10px rgba(0,0,0,.6)",
                }}
              >
                Kamera
              </button>
              <button
                type="button"
                onClick={() => libraryRef.current?.click()}
                className="mlk-btn-secondary mlk-t-label"
                style={{ padding: "13px 18px" }}
              >
                Mediathek
              </button>
            </div>
          )}
        </div>
        {/* `capture` jumps straight to the camera; without it the picker opens
            on existing photos. Two inputs, because one cannot do both. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPhoto}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPhoto}
        />
        {photoNote && (
          <p className="mlk-t-meta mt-2 px-1" role="status">
            {photoNote}
          </p>
        )}

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
        {/* The amount parser is not obvious from an empty field, so name the
            units it understands instead of letting people guess. */}
        <p className="mlk-t-meta mt-1.5">Mengen: {UNIT_HINT}</p>

        <div className="mt-3.5 flex flex-col gap-3">
          {draft.ings.map((row, i) => {
            const sug = sugRow === i ? suggestionsFor(i) : [];
            const named = row.name.trim().length > 0;
            const found = named ? lookup(row.name) : null;
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

                {/* Immediate feedback: whether this name resolves to numbers
                    at all. Without it, a wrong name only shows up much later
                    as a mysterious 0. */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  {!named ? (
                    <span className="mlk-t-meta">&nbsp;</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingNutri(row.name.trim())}
                      className="mlk-t-meta mlk-truncate min-w-0 text-left"
                      style={
                        found?.nutriPer100
                          ? undefined
                          : { color: "var(--color-accent)" }
                      }
                    >
                      {found?.nutriPer100
                        ? `Erkannt · ${found.nutriPer100.kcal} kcal / ${
                            found.basis === "stk" ? "Stück" : "100 g"
                          }${
                            found.gramsPerPiece
                              ? ` · 1 Stk ≈ ${found.gramsPerPiece} g`
                              : ""
                          } · ändern`
                        : "Keine Werte — eintragen →"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="mlk-icon-btn -mr-2"
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
                    ? p.reason === "amount"
                      ? "Menge fehlt"
                      : "keine Werte"
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
            {missing.length} Zutat(en) stehen nicht in der Nährwerttabelle
            {missing.length > 0 ? ` (${missing.join(", ")})` : ""}, und die
            KI-Schätzung ist grad nicht erreichbar. Alles andere ist
            berechnet — das Rezept lässt sich normal speichern.
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

      {editingNutri && (
        <NutritionSheet
          name={editingNutri}
          current={lookup(editingNutri)}
          onClose={() => setEditingNutri(null)}
        />
      )}

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
