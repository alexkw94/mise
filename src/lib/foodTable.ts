/**
 * Built-in nutrition table.
 *
 * Why this exists: reading nutrition off a Coop/Migros product page, or out of
 * Open Food Facts, is impossible from a static site — none of them send CORS
 * headers, so the browser blocks the request. Both would need a server. This
 * table is the alternative that actually works: free, offline, instant, no
 * dependency, no rate limit, no key.
 *
 * Values are typical reference figures per 100 g of the raw ingredient, in the
 * order [kcal, protein, fat, carbohydrate]. They are not brand-specific — a
 * particular product can differ by 10–15%. For anything where that matters,
 * overwrite the entry from a product label (the value is then stored in the
 * user's own library and wins over this table from then on).
 *
 * The last, optional number is the weight of one piece in grams. It is what
 * makes "2 Stk Zwiebel" and "500 g Zwiebeln" both compute correctly.
 */

export interface FoodEntry {
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  /** Grams per piece, for ingredients people count rather than weigh. */
  gramsPerPiece?: number;
}

type Row = [string, number, number, number, number, number?];

const ROWS: Row[] = [
  // ── Getreide, Teigwaren, Beilagen ───────────────────────────────────────
  ["Weissmehl", 348, 10, 1, 72],
  ["Halbweissmehl", 340, 11, 1.2, 70],
  ["Ruchmehl", 330, 12, 1.5, 66],
  ["Vollkornmehl", 325, 13, 2.5, 59],
  ["Pizzamehl Tipo 00", 341, 11, 1, 71],
  ["Maisstärke", 380, 0.3, 0.1, 91],
  ["Pasta", 357, 12, 1.5, 72],
  ["Spaghetti", 357, 12, 1.5, 72],
  ["Vollkornpasta", 335, 13, 2.5, 62],
  ["Reis", 355, 7, 1, 78],
  ["Basmatireis", 349, 8, 1, 77],
  ["Risottoreis", 350, 7, 1, 78],
  ["Vollkornreis", 340, 8, 2.7, 70],
  ["Couscous", 376, 13, 1, 72],
  ["Polenta", 358, 8, 1.5, 76],
  ["Quinoa", 368, 14, 6, 58],
  ["Bulgur", 342, 12, 1.3, 64],
  ["Haferflocken", 372, 13, 7, 59],
  ["Brot", 265, 9, 3, 49],
  ["Vollkornbrot", 240, 8, 3, 42],
  ["Semmelbrösel", 380, 12, 5, 70],
  ["Kartoffeln", 77, 2, 0.1, 17, 120],
  ["Süsskartoffeln", 86, 1.6, 0.1, 20, 200],
  ["Gnocchi", 150, 4, 0.5, 32],
  ["Tortilla", 300, 8, 7, 50, 45],
  ["Blätterteig", 380, 6, 24, 34],

  // ── Milchprodukte, Käse, Ei ─────────────────────────────────────────────
  ["Milch", 65, 3.3, 3.5, 4.8],
  ["Halbfettmilch", 47, 3.4, 1.5, 4.8],
  ["Vollrahm", 345, 2.2, 36, 3],
  ["Halbrahm", 200, 2.6, 20, 3.5],
  ["Sauerrahm", 190, 2.8, 18, 3.5],
  ["Crème fraîche", 300, 2.4, 30, 3],
  ["Joghurt", 62, 3.5, 3.2, 4.7],
  ["Griechischer Joghurt", 97, 9, 5, 3.6],
  ["Skyr", 63, 11, 0.2, 4],
  ["Magerquark", 67, 12, 0.3, 4],
  ["Halbfettquark", 100, 12, 5, 3.5],
  ["Hüttenkäse", 98, 12, 4.3, 3],
  ["Butter", 745, 0.7, 82, 0.6],
  ["Mozzarella", 250, 18, 19, 1.5],
  ["Fiordilatte", 280, 18, 22, 2],
  ["Parmigiano Reggiano", 402, 33, 29, 0],
  ["Sbrinz", 400, 30, 32, 0],
  ["Gruyère", 413, 30, 33, 0.5],
  ["Emmentaler", 380, 28, 30, 0.5],
  ["Appenzeller", 400, 27, 32, 0.5],
  ["Raclettekäse", 355, 24, 28, 1],
  ["Bergkäse", 400, 29, 31, 0.5],
  ["Feta", 264, 14, 21, 4],
  ["Frischkäse", 250, 6, 24, 3],
  ["Ricotta", 150, 9, 11, 3],
  ["Mascarpone", 430, 4, 45, 3],
  ["Cheddar", 410, 25, 34, 1.3],
  ["Ei", 143, 12.6, 9.5, 0.7, 55],
  ["Eiweiss", 52, 11, 0.2, 0.7, 33],
  ["Eigelb", 320, 16, 27, 3.6, 18],

  // ── Fleisch, Wurst ──────────────────────────────────────────────────────
  ["Pouletbrust", 106, 23, 1.2, 0],
  ["Pouletschenkel", 185, 18, 12, 0],
  ["Poulet", 160, 20, 9, 0],
  ["Rindshackfleisch", 220, 19, 16, 0],
  ["Hackfleisch", 240, 18, 19, 0],
  ["Rindsentrecôte", 220, 21, 15, 0],
  ["Rindsfilet", 145, 21, 6, 0],
  ["Rindfleisch", 190, 21, 12, 0],
  ["Schweinefilet", 120, 22, 3, 0],
  ["Schweinskotelett", 200, 21, 13, 0],
  ["Kalbfleisch", 110, 21, 3, 0],
  ["Lammfleisch", 230, 20, 17, 0],
  ["Speck", 400, 15, 38, 0],
  ["Trockenfleisch", 250, 40, 8, 1],
  ["Rohschinken", 240, 26, 15, 0.5],
  ["Kochschinken", 110, 20, 3, 1],
  ["Salami", 400, 22, 34, 1],
  ["Cervelat", 300, 13, 27, 2],
  ["Bratwurst", 300, 14, 27, 1],
  ["Chorizo", 380, 21, 32, 2],

  // ── Fisch, Meeresfrüchte ────────────────────────────────────────────────
  ["Lachs", 200, 20, 13, 0],
  ["Räucherlachs", 180, 22, 10, 0],
  ["Thunfisch", 110, 25, 1, 0],
  ["Forelle", 120, 20, 4, 0],
  ["Kabeljau", 80, 18, 0.7, 0],
  ["Egli", 85, 19, 0.7, 0],
  ["Crevetten", 85, 20, 0.5, 0],
  ["Sardellen", 190, 29, 8, 0],

  // ── Hülsenfrüchte, pflanzliches Protein ─────────────────────────────────
  ["Linsen", 340, 25, 1.5, 50],
  ["Rote Linsen", 350, 24, 1.5, 52],
  ["Linsen aus der Dose", 105, 8, 0.5, 15],
  ["Kichererbsen", 360, 19, 6, 50],
  ["Kichererbsen aus der Dose", 120, 7, 2.5, 16],
  ["Weisse Bohnen", 100, 7, 0.5, 15],
  ["Kidneybohnen", 105, 8, 0.5, 15],
  ["Schwarze Bohnen", 105, 8, 0.5, 15],
  ["Tofu", 130, 14, 8, 1.5],
  ["Räuchertofu", 150, 17, 9, 1],
  ["Tempeh", 190, 19, 11, 8],
  ["Seitan", 140, 25, 2, 4],

  // ── Gemüse ──────────────────────────────────────────────────────────────
  ["Zwiebel", 40, 1.2, 0.2, 7, 110],
  ["Schalotte", 72, 2.5, 0.1, 16, 30],
  ["Frühlingszwiebeln", 30, 1.8, 0.2, 4, 15],
  ["Knoblauch", 140, 6, 0.5, 28, 4],
  ["Karotten", 35, 0.9, 0.2, 7, 80],
  ["Zucchini", 20, 1.6, 0.3, 2, 200],
  ["Aubergine", 25, 1, 0.2, 4, 300],
  ["Peperoni", 30, 1.2, 0.3, 5, 150],
  ["Chili", 40, 2, 0.4, 7, 15],
  ["Tomaten", 18, 0.9, 0.2, 3, 120],
  ["Cherrytomaten", 20, 1, 0.2, 3, 15],
  ["Pelati", 32, 1.4, 0.2, 5],
  ["San-Marzano-Tomaten", 32, 1.4, 0.2, 5],
  ["Passata", 35, 1.5, 0.2, 6],
  ["Tomatenpüree", 80, 4, 0.5, 13],
  ["Gurke", 15, 0.7, 0.1, 2, 300],
  ["Kopfsalat", 15, 1.2, 0.2, 1.5],
  ["Nüsslisalat", 20, 2, 0.4, 1],
  ["Rucola", 25, 2.6, 0.7, 2],
  ["Spinat", 25, 3, 0.4, 1.5],
  ["Broccoli", 35, 3.5, 0.4, 3],
  ["Blumenkohl", 25, 2.5, 0.3, 3],
  ["Weisskohl", 25, 1.3, 0.2, 4],
  ["Rotkohl", 30, 1.5, 0.2, 5],
  ["Lauch", 30, 2, 0.3, 4, 200],
  ["Sellerie", 20, 1, 0.2, 2],
  ["Knollensellerie", 30, 1.5, 0.3, 5],
  ["Fenchel", 25, 1.2, 0.3, 3, 250],
  ["Champignons", 22, 3, 0.3, 1],
  ["Kürbis", 27, 1, 0.1, 5],
  ["Randen", 43, 1.6, 0.2, 8],
  ["Rosenkohl", 45, 4.5, 0.4, 5],
  ["Grüne Bohnen", 32, 2.4, 0.2, 5],
  ["Mais", 85, 3, 1.2, 15],
  ["Erbsen", 80, 5.5, 0.5, 11],
  ["Spargel", 20, 2, 0.2, 2],
  ["Zuckerschoten", 42, 3, 0.2, 7],
  ["Ingwer", 80, 1.8, 0.8, 15],
  ["Oliven", 145, 1, 15, 1],

  // ── Früchte ─────────────────────────────────────────────────────────────
  ["Apfel", 52, 0.3, 0.2, 12, 150],
  ["Banane", 89, 1.1, 0.3, 20, 120],
  ["Zitrone", 29, 1.1, 0.3, 3, 70],
  ["Limette", 30, 0.7, 0.2, 3, 60],
  ["Orange", 47, 0.9, 0.1, 9, 180],
  ["Birne", 57, 0.4, 0.1, 13, 170],
  ["Pfirsich", 39, 0.9, 0.3, 8, 150],
  ["Aprikosen", 48, 1.4, 0.4, 9, 40],
  ["Heidelbeeren", 57, 0.7, 0.3, 12],
  ["Erdbeeren", 32, 0.7, 0.3, 6],
  ["Himbeeren", 52, 1.2, 0.7, 5],
  ["Trauben", 69, 0.7, 0.2, 16],
  ["Mango", 60, 0.8, 0.4, 13, 300],
  ["Avocado", 160, 2, 15, 2, 170],
  ["Datteln", 280, 2.5, 0.4, 63, 8],
  ["Rosinen", 300, 3, 0.5, 68],

  // ── Nüsse, Samen ────────────────────────────────────────────────────────
  ["Baumnüsse", 654, 15, 65, 7],
  ["Mandeln", 580, 21, 50, 9],
  ["Haselnüsse", 630, 15, 61, 7],
  ["Cashewkerne", 550, 18, 44, 27],
  ["Pinienkerne", 670, 14, 68, 4],
  ["Sonnenblumenkerne", 580, 21, 51, 11],
  ["Kürbiskerne", 560, 30, 46, 11],
  ["Sesam", 570, 18, 50, 10],
  ["Leinsamen", 530, 18, 42, 3],
  ["Chiasamen", 490, 17, 31, 8],
  ["Erdnüsse", 570, 25, 48, 8],
  ["Erdnussbutter", 590, 25, 50, 12],

  // ── Öle, Fette ──────────────────────────────────────────────────────────
  ["Olivenöl", 884, 0, 100, 0],
  ["Rapsöl", 884, 0, 100, 0],
  ["Sonnenblumenöl", 884, 0, 100, 0],
  ["Sesamöl", 884, 0, 100, 0],
  ["Kokosöl", 890, 0, 100, 0],
  ["Margarine", 720, 0.2, 80, 0.4],

  // ── Würzen, Saucen, Flüssiges ───────────────────────────────────────────
  ["Salz", 0, 0, 0, 0],
  ["Pfeffer", 250, 10, 3, 45],
  ["Paprikapulver", 282, 14, 13, 54],
  ["Currypulver", 325, 13, 14, 40],
  ["Oregano", 265, 9, 4, 45],
  ["Basilikum", 23, 3, 0.6, 2.7],
  ["Thymian", 100, 5, 1.7, 15],
  ["Rosmarin", 130, 3.3, 5.9, 20],
  ["Petersilie", 36, 3, 0.8, 3],
  ["Koriander", 23, 2.1, 0.5, 1],
  ["Schnittlauch", 30, 3, 0.7, 1.5],
  ["Senf", 100, 5, 6, 5],
  ["Ketchup", 110, 1.2, 0.2, 25],
  ["Mayonnaise", 700, 1, 77, 2],
  ["Sojasauce", 60, 8, 0, 6],
  ["Balsamico", 90, 0.5, 0, 17],
  ["Weissweinessig", 20, 0, 0, 0.5],
  ["Honig", 300, 0.3, 0, 80],
  ["Zucker", 400, 0, 0, 100],
  ["Ahornsirup", 260, 0, 0, 67],
  ["Kokosmilch", 200, 2, 21, 3],
  ["Bouillon", 200, 10, 5, 25],
  ["Pesto", 450, 6, 45, 5],
  ["Weisswein", 70, 0.1, 0, 2.6],
  ["Rotwein", 68, 0.1, 0, 2.5],

  // ── Backen, Süsses ──────────────────────────────────────────────────────
  ["Hefe", 105, 12, 2, 8],
  ["Trockenhefe", 330, 40, 6, 35],
  ["Backpulver", 100, 0, 0, 25],
  ["Dunkle Schokolade", 550, 7, 35, 45],
  ["Kakaopulver", 350, 20, 14, 35],
];

export const FOOD_TABLE: FoodEntry[] = ROWS.map(
  ([name, kcal, p, f, c, gramsPerPiece]) => ({
    name,
    kcal,
    p,
    f,
    c,
    ...(gramsPerPiece ? { gramsPerPiece } : {}),
  }),
);

/**
 * Common ways people write an ingredient that are not the table's own name.
 * Kept small on purpose — the plural/singular handling below covers most of it.
 */
const ALIASES: Record<string, string> = {
  nudeln: "Pasta",
  teigwaren: "Pasta",
  penne: "Pasta",
  fusilli: "Pasta",
  spaghetti: "Spaghetti",
  rahm: "Vollrahm",
  sahne: "Vollrahm",
  vollmilch: "Milch",
  parmesan: "Parmigiano Reggiano",
  greyerzer: "Gruyère",
  poulet: "Poulet",
  hühnchen: "Poulet",
  hackfleisch: "Hackfleisch",
  gehacktes: "Hackfleisch",
  rüebli: "Karotten",
  möhren: "Karotten",
  paprika: "Peperoni",
  eier: "Ei",
  kefen: "Zuckerschoten",
  peterli: "Petersilie",
  öl: "Olivenöl",
  pinienkerne: "Pinienkerne",
  walnüsse: "Baumnüsse",
  joghurt: "Joghurt",
  naturejoghurt: "Joghurt",
  dosentomaten: "Pelati",
  tomatenmark: "Tomatenpüree",
  gemüsebouillon: "Bouillon",
  gemüsebrühe: "Bouillon",
  schokolade: "Dunkle Schokolade",
  kartoffel: "Kartoffeln",
  zwiebeln: "Zwiebel",
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_NAME = new Map<string, FoodEntry>();
for (const entry of FOOD_TABLE) BY_NAME.set(norm(entry.name), entry);

/** Strip a German plural ending so "Zwiebeln" finds "Zwiebel". */
function singularCandidates(n: string): string[] {
  const out = [n];
  if (n.endsWith("en")) out.push(n.slice(0, -2));
  if (n.endsWith("n")) out.push(n.slice(0, -1));
  if (n.endsWith("e")) out.push(n.slice(0, -1));
  if (n.endsWith("s")) out.push(n.slice(0, -1));
  // …and the other direction, for "Karotte" → "Karotten".
  out.push(n + "n", n + "en", n + "e");
  return out;
}

/**
 * Find a table entry for a free-text ingredient name.
 *
 * Order: exact → alias → plural/singular → longest whole-word match inside the
 * typed text, so "Pouletbrust vom Bio-Metzger" still resolves.
 */
export function lookupFood(rawName: string): FoodEntry | null {
  const n = norm(rawName);
  if (!n) return null;

  const direct = BY_NAME.get(n);
  if (direct) return direct;

  const alias = ALIASES[n];
  if (alias) return BY_NAME.get(norm(alias)) ?? null;

  for (const candidate of singularCandidates(n)) {
    const hit = BY_NAME.get(candidate);
    if (hit) return hit;
    const aliased = ALIASES[candidate];
    if (aliased) return BY_NAME.get(norm(aliased)) ?? null;
  }

  // Longest match wins: "griechischer joghurt" must not resolve to "Joghurt".
  let best: FoodEntry | null = null;
  for (const entry of FOOD_TABLE) {
    const key = norm(entry.name);
    if (!new RegExp(`(^| )${key}( |$)`).test(n)) continue;
    if (!best || key.length > norm(best.name).length) best = entry;
  }
  return best;
}
