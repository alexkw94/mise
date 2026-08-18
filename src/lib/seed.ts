import type { AppState, Basis, NutriPer } from "./types";

/**
 * Starter library, transcribed from the prototype's NUTRI table.
 * Values are per 100 g unless basis is "stk" (then per piece).
 */
export const SEED_LIBRARY: Record<
  string,
  { basis: Basis; nutriPer100: NutriPer; url: string }
> = {
  "Pizzamehl Tipo 00": { basis: "100g", nutriPer100: { kcal: 341, p: 11, f: 1, c: 71 }, url: "https://www.coop.ch/de/lebensmittel/farina-tipo-00" },
  Fiordilatte: { basis: "100g", nutriPer100: { kcal: 280, p: 18, f: 22, c: 2 }, url: "https://www.migros.ch/de/product/fiordilatte" },
  "San-Marzano-Tomaten": { basis: "100g", nutriPer100: { kcal: 32, p: 1.4, f: 0.2, c: 5 }, url: "https://www.coop.ch/de/lebensmittel/san-marzano" },
  Basilikum: { basis: "100g", nutriPer100: { kcal: 23, p: 3, f: 0.6, c: 2.7 }, url: "" },
  "Olivenöl": { basis: "100g", nutriPer100: { kcal: 884, p: 0, f: 100, c: 0 }, url: "https://www.coop.ch/de/lebensmittel/olivenoel" },
  Pouletbrust: { basis: "100g", nutriPer100: { kcal: 106, p: 23, f: 1.2, c: 0 }, url: "https://www.migros.ch/de/product/poulet" },
  Peperoni: { basis: "stk", nutriPer100: { kcal: 37, p: 1.5, f: 0.3, c: 6 }, url: "" },
  "Griechischer Joghurt": { basis: "100g", nutriPer100: { kcal: 97, p: 9, f: 5, c: 3.6 }, url: "https://www.coop.ch/de/lebensmittel/joghurt" },
  Paprikapulver: { basis: "100g", nutriPer100: { kcal: 282, p: 14, f: 13, c: 54 }, url: "" },
  Spaghetti: { basis: "100g", nutriPer100: { kcal: 357, p: 12, f: 1.5, c: 72 }, url: "https://www.migros.ch/de/product/spaghetti" },
  Zitrone: { basis: "stk", nutriPer100: { kcal: 20, p: 0.7, f: 0.2, c: 3 }, url: "" },
  Vollrahm: { basis: "100g", nutriPer100: { kcal: 345, p: 2.2, f: 36, c: 3 }, url: "https://www.coop.ch/de/lebensmittel/vollrahm" },
  "Parmigiano Reggiano": { basis: "100g", nutriPer100: { kcal: 402, p: 33, f: 29, c: 0 }, url: "https://www.coop.ch/de/lebensmittel/parmigiano" },
};

/**
 * Offered when tagging a recipe, on top of whatever categories already exist
 * in the collection. Just suggestions — any name can be typed.
 */
export const SUGGESTED_CATEGORIES = [
  "High-Protein",
  "Breakfast",
  "Vegan",
  "Vegetarisch",
  "Low-Carb",
  "Schnell",
  "Grill",
  "Pasta",
  "Dessert",
  "Meal-Prep",
];

/** Only used by the "Was koch ich?" tab (FEATURES.cookTab). */
export const PANTRY_CHIPS = [
  "Poulet",
  "Zucchini",
  "Reis",
  "Zitrone",
  "Joghurt",
  "Peperoni",
];

const now = Date.now();

export function seedState(): AppState {
  return {
    recipes: [
      {
        id: "seed-1",
        title: "Pizza Napoletana Margherita",
        categories: ["Pizza", "Vegetarisch"],
        photoId: null,
        body: "48 h kalte Gare, Ofen auf Anschlag mit Stahl. Teig nur mit den Fingerspitzen aufziehen, Rand nicht plattdrücken.",
        ings: [
          { name: "Pizzamehl Tipo 00", amount: "500 g", url: SEED_LIBRARY["Pizzamehl Tipo 00"].url, shotId: null },
          { name: "Fiordilatte", amount: "250 g", url: SEED_LIBRARY.Fiordilatte.url, shotId: null },
          { name: "San-Marzano-Tomaten", amount: "300 g", url: SEED_LIBRARY["San-Marzano-Tomaten"].url, shotId: null },
          { name: "Basilikum", amount: "1 Bund", url: "", shotId: null },
          { name: "Olivenöl", amount: "2 EL", url: SEED_LIBRARY["Olivenöl"].url, shotId: null },
        ],
        nutri: null,
        createdAt: now - 3,
        updatedAt: now - 3,
      },
      {
        id: "seed-2",
        title: "Poulet-Spiessli vom Grill",
        categories: ["High-Protein", "Grill"],
        photoId: null,
        body: "Über Nacht in Joghurt-Paprika-Marinade. Direkte Hitze, zwei Minuten pro Seite, dann in die indirekte Zone ziehen.",
        ings: [
          { name: "Pouletbrust", amount: "500 g", url: SEED_LIBRARY.Pouletbrust.url, shotId: null },
          { name: "Peperoni", amount: "2 Stk", url: "", shotId: null },
          { name: "Griechischer Joghurt", amount: "150 g", url: SEED_LIBRARY["Griechischer Joghurt"].url, shotId: null },
          { name: "Paprikapulver", amount: "1 TL", url: "", shotId: null },
        ],
        nutri: null,
        createdAt: now - 2,
        updatedAt: now - 2,
      },
      {
        id: "seed-3",
        title: "Pasta al Limone",
        categories: ["Pasta", "Schnell", "Vegetarisch"],
        photoId: null,
        body: "Rahm nur warm ziehen lassen, Zitrone erst vom Feuer weg. Pastawasser ist die halbe Sauce.",
        ings: [
          { name: "Spaghetti", amount: "250 g", url: SEED_LIBRARY.Spaghetti.url, shotId: null },
          { name: "Zitrone", amount: "2 Stk", url: "", shotId: null },
          { name: "Vollrahm", amount: "150 g", url: SEED_LIBRARY.Vollrahm.url, shotId: null },
          { name: "Parmigiano Reggiano", amount: "60 g", url: SEED_LIBRARY["Parmigiano Reggiano"].url, shotId: null },
        ],
        nutri: null,
        createdAt: now - 1,
        updatedAt: now - 1,
      },
    ],
    longlist: [
      { id: "seed-l1", note: "Tonkatsu-Sando von diesem Basler Beizli", url: "https://www.youtube.com/watch?v=aBcD1234", imageId: null, done: false, createdAt: now - 3 },
      { id: "seed-l2", note: "Focaccia mit Trauben — Screenshot vom Herbstmarkt", url: "https://images.example.com/focaccia.jpg", imageId: null, done: false, createdAt: now - 2 },
      { id: "seed-l3", note: "Kalbsbries anbraten, endlich mal trauen", url: "", imageId: null, done: true, createdAt: now - 1 },
    ],
    library: {},
    removedLib: [],
  };
}
