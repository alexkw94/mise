"use client";

import { useMemo, useState } from "react";
import { Screen, ScreenHeader, ScreenScroll, TABBAR } from "./Screen";
import { StoredImage } from "./StoredImage";
import { macroLine } from "@/lib/nutrition";
import { shareRecipes } from "@/lib/share";
import { BackupSheet } from "./BackupSheet";
import { ALL_CATEGORIES, type Recipe } from "@/lib/types";

function RecipeCard({
  recipe,
  onOpen,
}: {
  recipe: Recipe;
  onOpen: (r: Recipe) => void;
}) {
  const names = recipe.ings.map((i) => i.name).filter(Boolean);
  const ingLine = names.join(" · ");
  const ingCount = names.length;

  return (
    <button
      type="button"
      onClick={() => onOpen(recipe)}
      className="mlk-card mlk-card-lift block w-full cursor-pointer overflow-hidden text-left"
    >
      <div className="mlk-plate flex h-[158px] items-end justify-between p-3.5">
        <StoredImage
          id={recipe.photoId}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="relative mlk-chip">
          {recipe.photoId ? "Foto" : "Kein Foto"}
        </span>
        <span
          className="relative mlk-chip"
          style={{
            letterSpacing: "normal",
            textTransform: "none",
            fontWeight: 400,
            fontSize: "11.5px",
          }}
        >
          {ingCount} {ingCount === 1 ? "Zutat" : "Zutaten"}
        </span>
      </div>

      <div className="px-[18px] pt-4 pb-[18px]">
        {recipe.categories.length > 0 && (
          <div className="mlk-kicker mlk-truncate mb-1.5">
            {recipe.categories.join(" · ")}
          </div>
        )}
        <div className="mlk-card-title">{recipe.title}</div>
        <div className="mlk-t-meta mlk-truncate mt-1.5">{ingLine}</div>

        <div
          className="mt-3.5 flex flex-wrap items-baseline gap-2.5 pt-[13px]"
          style={{ borderTop: "0.5px solid rgba(0,0,0,.09)" }}
        >
          <span
            style={{
              font: "600 13.5px/1 var(--font-sans)",
              letterSpacing: "-0.01em",
            }}
          >
            {recipe.nutri ? `${recipe.nutri.kcal} kcal` : "kcal offen"}
          </span>
          <span className="mlk-t-meta">
            {recipe.nutri ? macroLine(recipe.nutri) : "noch nicht berechnet"}
          </span>
        </div>
      </div>
    </button>
  );
}

export function RecipesTab({
  recipes,
  categories,
  q,
  onQ,
  category,
  onCategory,
  onOpen,
  onNew,
}: {
  recipes: Recipe[];
  categories: string[];
  q: string;
  onQ: (v: string) => void;
  category: string;
  onCategory: (c: string) => void;
  onOpen: (r: Recipe) => void;
  onNew: () => void;
}) {
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);

  const inCategory = useMemo(
    () =>
      category === ALL_CATEGORIES
        ? recipes
        : recipes.filter((r) => r.categories.includes(category)),
    [recipes, category],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return inCategory;
    return inCategory.filter(
      (r) =>
        r.title.toLowerCase().includes(term) ||
        r.ings.some((i) => i.name.toLowerCase().includes(term)),
    );
  }, [inCategory, q]);

  /** Shares the whole active category — the list you are looking at. */
  async function shareCategory() {
    const outcome = await shareRecipes(inCategory, category);
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

  const count = recipes.length;

  return (
    <Screen>
      <ScreenHeader
        kicker="Meine Sammlung"
        title="Rezepte"
        trailing={`${count} ${count === 1 ? "Karte" : "Karten"}`}
        action={
          <button
            type="button"
            onClick={() => setBackupOpen(true)}
            className="mlk-icon-btn -mr-2"
            aria-label="Sammlung sichern"
            title="Sammlung sichern"
          >
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none"
                 stroke="currentColor" strokeWidth="1.6"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 3v9" />
              <path d="M6.5 8.5 10 12l3.5-3.5" />
              <path d="M3.5 13.5v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2" />
            </svg>
          </button>
        }
      >
        <input
          className="mlk-input mt-4"
          type="search"
          placeholder="Rezept oder Zutat suchen"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          aria-label="Rezept oder Zutat suchen"
        />

        {categories.length > 0 && (
          <div className="mlk-filter-row mt-3.5">
            <button
              type="button"
              className="mlk-cat"
              aria-pressed={category === ALL_CATEGORIES}
              onClick={() => onCategory(ALL_CATEGORIES)}
            >
              Alle
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className="mlk-cat"
                aria-pressed={category === c}
                onClick={() => onCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </ScreenHeader>

      <ScreenScroll>
        {category !== ALL_CATEGORIES && inCategory.length > 0 && (
          <div className="mb-[18px] flex items-center justify-between gap-3">
            <span className="mlk-t-meta">
              {inCategory.length}{" "}
              {inCategory.length === 1 ? "Rezept" : "Rezepte"} in „{category}“
            </span>
            <button
              type="button"
              onClick={shareCategory}
              className="mlk-btn-secondary h-9 px-3.5"
              style={{ fontSize: 13.5 }}
            >
              Kategorie teilen
            </button>
          </div>
        )}

        {shareNote && (
          <p className="mlk-t-meta mb-3 px-1" role="status">
            {shareNote}
          </p>
        )}

        <div className="flex flex-col gap-[18px]">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} onOpen={onOpen} />
          ))}

          {filtered.length === 0 && (
            <div className="mlk-card-flat px-[22px] py-7">
              <div
                style={{
                  font: "600 24px/1.15 var(--font-sans)",
                  letterSpacing: "-0.026em",
                }}
              >
                {count === 0 ? "Noch keine Karte." : "Nichts gefunden."}
              </div>
              <p className="mlk-t-body mt-2.5" style={{ color: "var(--color-muted)" }}>
                {count === 0
                  ? "Koch etwas Gutes und halt es fest — Foto, Zutaten, fertig. Dauert unter einer Minute."
                  : "Andere Schreibweise probieren, Filter zurücksetzen, oder das Rezept neu anlegen."}
              </p>
              <button
                type="button"
                onClick={onNew}
                className="mlk-btn-primary mlk-t-label mt-5 h-[46px] px-[22px]"
              >
                {count === 0 ? "Erstes Rezept anlegen" : "Rezept anlegen"}
              </button>
            </div>
          )}
        </div>
      </ScreenScroll>

      {backupOpen && <BackupSheet onClose={() => setBackupOpen(false)} />}

      <button
        type="button"
        onClick={onNew}
        className="mlk-btn-primary absolute right-5 z-20 h-[58px] px-6"
        style={{
          bottom: `calc(${TABBAR} + 24px)`,
          boxShadow:
            "0 14px 34px -12px rgba(0,0,0,.65), inset 0 .5px 0 rgba(255,255,255,.25)",
        }}
      >
        <span style={{ fontSize: "22px", fontWeight: 300, lineHeight: 1 }}>
          +
        </span>
        Neues Rezept
      </button>
    </Screen>
  );
}
