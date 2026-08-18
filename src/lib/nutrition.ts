import type {
  Basis,
  Ingredient,
  LibraryEntry,
  NutriPer,
  PerIngredientNutri,
  RecipeNutri,
} from "./types";

/** Rough gram weights for kitchen units the amount field accepts. */
const UNIT_G: Record<string, number> = {
  el: 14,
  tl: 5,
  bund: 20,
  prise: 1,
  msp: 0.5,
};

/**
 * Turn a free-text amount ("500 g", "2 EL", "1,5 kg", "2 Stk") into the
 * quantity the entry's basis expects: grams for "100g", pieces for "stk".
 */
export function quantity(amount: string, basis: Basis): number {
  const raw = String(amount ?? "").toLowerCase().trim();
  const n = parseFloat(raw.replace(",", ".")) || 0;
  if (n === 0) return 0;
  if (basis === "stk") return n;

  if (/\bkg\b/.test(raw)) return n * 1000;
  if (/\bdl\b/.test(raw)) return n * 100;
  if (/\bl\b/.test(raw)) return n * 1000;
  // ml is treated 1:1 with g — fine for the liquids a home kitchen measures.
  if (/\bg\b/.test(raw) || /\bml\b/.test(raw)) return n;

  for (const unit of Object.keys(UNIT_G)) {
    if (new RegExp(`\\b${unit}\\b`).test(raw)) return n * UNIT_G[unit];
  }
  // Bare number with no unit: assume grams.
  return n;
}

const r0 = (x: number) => Math.round(x);

/**
 * Scale library values (per 100 g / per piece) up to the recipe's amounts.
 * This is the whole point of normalising the library: the same "Olivenöl"
 * entry has to be correct at 2 EL and at 500 g.
 */
export function computeNutrition(
  ings: Ingredient[],
  lookup: (name: string) => { basis: Basis; nutriPer100: NutriPer | null } | null,
): RecipeNutri {
  const per: PerIngredientNutri[] = [];
  const total = { kcal: 0, p: 0, f: 0, c: 0 };
  let unknown = 0;

  for (const ig of ings) {
    if (!ig.name?.trim()) continue;
    const entry = lookup(ig.name);

    if (!entry?.nutriPer100) {
      unknown++;
      per.push({ name: ig.name, kcal: null, p: 0, f: 0, c: 0 });
      continue;
    }

    const q = quantity(ig.amount, entry.basis);
    const factor = entry.basis === "stk" ? q : q / 100;
    const v = {
      kcal: entry.nutriPer100.kcal * factor,
      p: entry.nutriPer100.p * factor,
      f: entry.nutriPer100.f * factor,
      c: entry.nutriPer100.c * factor,
    };

    total.kcal += v.kcal;
    total.p += v.p;
    total.f += v.f;
    total.c += v.c;

    per.push({
      name: ig.name,
      kcal: r0(v.kcal),
      p: r0(v.p),
      f: r0(v.f),
      c: r0(v.c),
    });
  }

  return {
    kcal: r0(total.kcal),
    p: r0(total.p),
    f: r0(total.f),
    c: r0(total.c),
    per,
    note: unknown
      ? `${unknown} Zutat(en) ohne Nährwertangabe — Schätzung entsprechend grob. Screenshot der Tabelle nachreichen macht sie genauer.`
      : "Schätzung auf Basis der Bibliothekswerte pro 100 g / Stück, hochgerechnet auf deine Mengen. Abweichung realistisch ±10 %.",
  };
}

export function nutriLine(entry: LibraryEntry): string {
  if (!entry.nutriPer100) return "Nährwerte offen — Screenshot fehlt";
  const { kcal, p, f, c } = entry.nutriPer100;
  const basis = entry.basis === "stk" ? "/ Stück" : "/ 100 g";
  return `${kcal} kcal · ${p} g E · ${f} g F · ${c} g KH ${basis}`;
}

export function macroLine(n: { p: number; f: number; c: number }): string {
  return `${n.p} g E · ${n.f} g F · ${n.c} g KH`;
}

/** German plural for the one count shown all over the app. */
export function portions(n: number): string {
  return `${n} ${n === 1 ? "Portion" : "Portionen"}`;
}

/** Heuristic: piece-based when the amount reads like a count. */
export function guessBasis(amount: string): Basis {
  return /\b(stk|stück|stueck)\b/i.test(amount ?? "") ? "stk" : "100g";
}
