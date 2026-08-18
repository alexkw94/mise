"use client";

import { useCallback, useSyncExternalStore } from "react";
import type {
  AppState,
  Basis,
  LibraryEntry,
  NutriPer,
  Recipe,
} from "./types";
import { SEED_LIBRARY, seedState } from "./seed";
import { computeNutrition } from "./nutrition";

const KEY = "mlk:state:v1";

/**
 * Single-user local store. Everything is one JSON blob in localStorage;
 * images live in IndexedDB (see lib/idb.ts) and are referenced by id.
 * Swapping this for Supabase means replacing `persist`/`load` and the
 * mutators below with queries — the component tree never touches storage.
 */

let state: AppState = seedState();
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded: the JSON has grown past ~5 MB, which should not happen
    // now that images are in IndexedDB. Dropping the write is better than
    // taking the app down — the in-memory state stays correct for this session.
  }
}

export function hydrate() {
  if (hydrated || typeof localStorage === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      state = {
        // `categories` was added after the first release — state saved before
        // then has no such field, so fill it in rather than crash on undefined.
        recipes: (parsed.recipes ?? []).map((r) => ({
          ...r,
          categories: r.categories ?? [],
        })),
        longlist: parsed.longlist ?? [],
        library: parsed.library ?? {},
        removedLib: parsed.removedLib ?? [],
      };
      emit();
    }
  } catch {
    // Corrupt payload — keep the seed rather than crash on boot.
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const getSnapshot = () => state;
const getServerSnapshot = () => state;

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function set(next: (s: AppState) => AppState) {
  state = next(state);
  persist();
  emit();
}

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/* -------------------------------------------------------------------------
   Ingredient library — derived, never stored as a separate list.
   ------------------------------------------------------------------------- */

/**
 * The library builds itself from whatever the recipes reference, merged by
 * name. Nutrition comes from a manual/AI override first, then the seed table.
 */
export function deriveLibrary(s: AppState): LibraryEntry[] {
  const map = new Map<string, LibraryEntry>();

  for (const recipe of s.recipes) {
    for (const ing of recipe.ings) {
      const name = ing.name?.trim();
      if (!name || s.removedLib.includes(name)) continue;

      let entry = map.get(name);
      if (!entry) {
        const override = s.library[name];
        const seed = SEED_LIBRARY[name];
        entry = {
          name,
          url: "",
          shotId: null,
          basis: override?.basis ?? seed?.basis ?? "100g",
          nutriPer100: override?.nutriPer100 ?? seed?.nutriPer100 ?? null,
          uses: [],
        };
        map.set(name, entry);
      }
      if (ing.url && !entry.url) entry.url = ing.url;
      if (ing.shotId && !entry.shotId) entry.shotId = ing.shotId;
      entry.uses.push(recipe.title);
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/**
 * Every category in use, most-used first so the filter row leads with what
 * the collection actually is. Categories are not a separate stored list —
 * they exist exactly as long as a recipe carries them.
 */
export function deriveCategories(s: AppState): string[] {
  const counts = new Map<string, number>();
  for (const r of s.recipes) {
    for (const c of r.categories ?? []) {
      const name = c.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))
    .map(([name]) => name);
}

/** Lookup used by the offline nutrition computation. */
export function makeLookup(s: AppState) {
  return (name: string): { basis: Basis; nutriPer100: NutriPer | null } | null => {
    const override = s.library[name];
    if (override) return override;
    const seed = SEED_LIBRARY[name];
    if (seed) return { basis: seed.basis, nutriPer100: seed.nutriPer100 };
    return null;
  };
}

/* -------------------------------------------------------------------------
   Mutators
   ------------------------------------------------------------------------- */

export const actions = {
  /**
   * Fill in nutrition for recipes whose ingredients the local library already
   * covers. The AI route is for what the library does not know — there is no
   * reason to spend a call (or show "kcal offen") on a recipe made entirely
   * of ingredients we have per-100 g values for.
   */
  backfillNutrition() {
    const lookup = makeLookup(state);
    const needs = state.recipes.filter(
      (r) => !r.nutri && r.ings.some((i) => lookup(i.name)?.nutriPer100),
    );
    if (needs.length === 0) return;
    set((s) => ({
      ...s,
      recipes: s.recipes.map((r) =>
        needs.some((n) => n.id === r.id)
          ? { ...r, nutri: computeNutrition(r.ings, lookup) }
          : r,
      ),
    }));
  },

  saveRecipe(recipe: Recipe) {
    set((s) => {
      const exists = s.recipes.some((r) => r.id === recipe.id);
      const stamped = { ...recipe, updatedAt: Date.now() };
      return {
        ...s,
        recipes: exists
          ? s.recipes.map((r) => (r.id === recipe.id ? stamped : r))
          : [stamped, ...s.recipes],
      };
    });
  },

  deleteRecipe(id: string) {
    set((s) => ({ ...s, recipes: s.recipes.filter((r) => r.id !== id) }));
  },

  /** Used by the share-link import. Always adds; never overwrites. */
  importRecipes(recipes: Recipe[]) {
    if (recipes.length === 0) return;
    set((s) => ({ ...s, recipes: [...recipes, ...s.recipes] }));
  },

  /** Rename a category everywhere it appears. */
  renameCategory(from: string, to: string) {
    const next = to.trim();
    if (!next || next === from) return;
    set((s) => ({
      ...s,
      recipes: s.recipes.map((r) =>
        r.categories.includes(from)
          ? {
              ...r,
              categories: [...new Set(r.categories.map((c) => (c === from ? next : c)))],
            }
          : r,
      ),
    }));
  },

  /** Store AI/manual per-100g values so every recipe using it recomputes. */
  setLibraryNutrition(name: string, basis: Basis, nutriPer100: NutriPer | null) {
    set((s) => ({
      ...s,
      library: { ...s.library, [name]: { basis, nutriPer100 } },
      removedLib: s.removedLib.filter((n) => n !== name),
    }));
  },

  removeFromLibrary(name: string) {
    set((s) => ({ ...s, removedLib: [...s.removedLib, name] }));
  },

  addLonglist(note: string, url: string, imageId: string | null = null) {
    set((s) => ({
      ...s,
      longlist: [
        { id: newId(), note, url, imageId, done: false, createdAt: Date.now() },
        ...s.longlist,
      ],
    }));
  },

  toggleLonglist(id: string) {
    set((s) => ({
      ...s,
      longlist: s.longlist.map((l) =>
        l.id === id ? { ...l, done: !l.done } : l,
      ),
    }));
  },

  removeLonglist(id: string) {
    set((s) => ({ ...s, longlist: s.longlist.filter((l) => l.id !== id) }));
  },
};

export function useActions() {
  return useCallback(() => actions, [])();
}
