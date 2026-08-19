"use client";

import { useEffect, useMemo, useState } from "react";
import { TabBar } from "./TabBar";
import { RecipesTab } from "./RecipesTab";
import { IngredientsTab } from "./IngredientsTab";
import { CookTab } from "./CookTab";
import { LonglistTab } from "./LonglistTab";
import { RecipeEditor } from "./RecipeEditor";
import { ImportSheet, bundleToRecipes } from "./ImportSheet";
import { SyncRunner } from "./SyncRunner";
import {
  actions,
  deriveCategories,
  deriveLibrary,
  hydrate,
  newId,
  useStore,
} from "@/lib/store";
import { FEATURES } from "@/lib/features";
import { readShareParam } from "@/lib/share";
import {
  ALL_CATEGORIES,
  type CookResult,
  type Recipe,
  type ShareBundle,
  type TabKey,
} from "@/lib/types";

function blankRecipe(): Recipe {
  return {
    id: newId(),
    title: "",
    body: "",
    photoId: null,
    ings: [{ name: "", amount: "", url: "", shotId: null }],
    categories: [],
    nutri: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function AppShell() {
  const state = useStore();
  const [tab, setTab] = useState<TabKey>("recipes");
  const [draft, setDraft] = useState<Recipe | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [incoming, setIncoming] = useState<ShareBundle | null>(null);

  // Search and filter live here so switching tabs and coming back keeps them.
  const [q, setQ] = useState("");
  const [libQ, setLibQ] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  useEffect(() => {
    hydrate();
    actions.backfillNutrition();
    // A share link opens the app with ?r=… — offer an import, never apply it
    // silently, and clear the parameter so a refresh doesn't ask twice.
    const bundle = readShareParam(window.location.search);
    if (bundle) {
      setIncoming(bundle);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const library = useMemo(() => deriveLibrary(state), [state]);
  const categories = useMemo(() => deriveCategories(state), [state]);

  // A filter pointing at a category that no longer exists would hide
  // everything with no way back, so fall back to "Alle".
  useEffect(() => {
    if (category !== ALL_CATEGORIES && !categories.includes(category)) {
      setCategory(ALL_CATEGORIES);
    }
  }, [categories, category]);

  const openRecipe = (recipe: Recipe) => {
    setDraft(structuredClone(recipe));
    setIsNew(false);
  };

  const startNew = () => {
    // Opening from inside a filtered category pre-tags the new recipe with it.
    const next = blankRecipe();
    if (category !== ALL_CATEGORIES) next.categories = [category];
    setDraft(next);
    setIsNew(true);
  };

  /**
   * "In meine Rezepte übernehmen" from the suggestion card.
   * Only reachable while FEATURES.cookTab is on.
   */
  const adoptSuggestion = (result: CookResult) => {
    const ings = result.ingredients
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({ name, amount: "", url: "", shotId: null }));
    setDraft({
      ...blankRecipe(),
      title: result.title,
      body: result.body,
      ings: ings.length ? ings : blankRecipe().ings,
    });
    setIsNew(true);
  };

  if (draft) {
    return (
      <RecipeEditor
        draft={draft}
        isNew={isNew}
        library={library}
        knownCategories={categories}
        onCancel={() => setDraft(null)}
        onSave={(recipe) => {
          actions.saveRecipe(recipe);
          setDraft(null);
          setTab("recipes");
        }}
        onDelete={(id) => {
          actions.deleteRecipe(id);
          setDraft(null);
          setTab("recipes");
        }}
      />
    );
  }

  return (
    // `relative` anchors the recipes FAB, which is positioned against the
    // full shell height so it can sit above the tab bar.
    <main className="relative flex h-[100dvh] flex-col overflow-hidden">
      {tab === "recipes" && (
        <RecipesTab
          recipes={state.recipes}
          categories={categories}
          q={q}
          onQ={setQ}
          category={category}
          onCategory={setCategory}
          onOpen={openRecipe}
          onNew={startNew}
        />
      )}
      {tab === "ingredients" && (
        <IngredientsTab library={library} q={libQ} onQ={setLibQ} />
      )}
      {tab === "cook" && FEATURES.cookTab && (
        <CookTab onAdopt={adoptSuggestion} />
      )}
      {tab === "longlist" && <LonglistTab items={state.longlist} />}

      <TabBar active={tab} onSelect={setTab} />

      <SyncRunner />

      {incoming && (
        <ImportSheet
          bundle={incoming}
          onImport={() => {
            actions.importRecipes(bundleToRecipes(incoming, newId));
            actions.backfillNutrition();
            setIncoming(null);
            setTab("recipes");
          }}
          onDismiss={() => setIncoming(null)}
        />
      )}
    </main>
  );
}
