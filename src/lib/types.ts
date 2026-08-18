export type Basis = "100g" | "stk";

/** Nutrition normalised per 100 g or per piece — never per recipe amount. */
export interface NutriPer {
  kcal: number;
  p: number;
  f: number;
  c: number;
}

export interface Macros extends NutriPer {}

export interface PerIngredientNutri {
  name: string;
  /** null when the row could not be computed; `reason` says why. */
  kcal: number | null;
  p: number;
  f: number;
  c: number;
  /**
   * "unknown" — no nutrition values for this name.
   * "amount"  — values exist, but the amount could not be read.
   */
  reason?: "unknown" | "amount" | null;
}

export interface RecipeNutri {
  kcal: number;
  p: number;
  f: number;
  c: number;
  per: PerIngredientNutri[];
  note: string;
}

export interface Ingredient {
  name: string;
  amount: string;
  url: string;
  /** IndexedDB key for the nutrition-table screenshot, or null. */
  shotId: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  body: string;
  /** IndexedDB key for the dish photo, or null. */
  photoId: string | null;
  ings: Ingredient[];
  /** Free-form labels: "High-Protein", "Breakfast", "Vegan", … */
  categories: string[];
  nutri: RecipeNutri | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * What travels in a share link. Photos are deliberately left out — they live
 * in the sender's IndexedDB and would blow past any sane URL length.
 */
export interface ShareBundle {
  v: 1;
  /** Category name when a whole category was shared, else null. */
  label: string | null;
  recipes: Array<
    Pick<Recipe, "title" | "body" | "categories"> & {
      ings: Array<Pick<Ingredient, "name" | "amount" | "url">>;
    }
  >;
}

/**
 * Library entry. Values are stored per 100 g / per piece so the same
 * ingredient reused at a different amount still computes correctly.
 */
export interface LibraryEntry {
  name: string;
  url: string;
  shotId: string | null;
  basis: Basis;
  nutriPer100: NutriPer | null;
  /** Weight of one piece, when the ingredient is usually counted. */
  gramsPerPiece?: number | null;
  /** Titles of the recipes that reference it — derived, not stored. */
  uses: string[];
}

export interface LonglistItem {
  id: string;
  note: string;
  url: string;
  imageId: string | null;
  done: boolean;
  createdAt: number;
}

export type TabKey = "recipes" | "ingredients" | "cook" | "longlist";

/** Sentinel for "no category filter" on the recipes list. */
export const ALL_CATEGORIES = "__all__";

export interface CookResult {
  title: string;
  body: string;
  missing: string;
  ingredients: string[];
}

export interface AppState {
  recipes: Recipe[];
  longlist: LonglistItem[];
  /** Manual per-100g overrides + names the user removed from the library. */
  library: Record<
    string,
    { basis: Basis; nutriPer100: NutriPer | null; gramsPerPiece?: number | null }
  >;
  removedLib: string[];
}
