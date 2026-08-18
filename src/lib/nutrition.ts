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

/** Units the amount field understands, shown to the user as a hint. */
export const UNIT_HINT = "g · kg · ml · dl · Stk · EL · TL · Bund · Prise";

/** Where an ingredient's numbers come from, once resolved. */
export interface NutriSource {
  basis: Basis;
  nutriPer100: NutriPer | null;
  /** Weight of one piece, when the ingredient is usually counted. */
  gramsPerPiece?: number | null;
}

const num = (raw: string) => parseFloat(raw.replace(",", ".")) || 0;

/**
 * How far to scale the source's values for this amount.
 *
 * Returns `null` when the amount cannot be resolved — an empty field, or a
 * piece count for an ingredient whose piece weight we do not know. Guessing
 * there would be worse than saying so: it is exactly how a recipe ends up
 * reporting a confident, wrong number.
 */
export function scaleFactor(amount: string, source: NutriSource): number | null {
  const raw = String(amount ?? "").toLowerCase().trim();
  if (!raw) return null;
  const n = num(raw);
  if (n === 0) return null;

  const counted = /\b(stk|stück|stueck|st)\b/.test(raw);

  // Values already per piece: only a count is meaningful.
  if (source.basis === "stk") return n;

  const grams = (() => {
    if (/\bkg\b/.test(raw)) return n * 1000;
    if (/\bdl\b/.test(raw)) return n * 100;
    if (/\bl\b/.test(raw)) return n * 1000;
    // ml is treated 1:1 with g — fine for what a home kitchen measures.
    if (/\bml\b/.test(raw) || /\bg\b/.test(raw)) return n;

    for (const unit of Object.keys(UNIT_G)) {
      if (new RegExp(`\\b${unit}\\b`).test(raw)) return n * UNIT_G[unit];
    }

    if (counted) {
      return source.gramsPerPiece ? n * source.gramsPerPiece : null;
    }
    // Bare number, no unit: grams.
    return n;
  })();

  return grams === null ? null : grams / 100;
}

const r0 = (x: number) => Math.round(x);

/**
 * Scale per-100 g / per-piece values up to the recipe's amounts.
 *
 * This is why the library stores normalised values: the same "Olivenöl" entry
 * has to be right at 2 EL and at 500 g.
 */
export function computeNutrition(
  ings: Ingredient[],
  lookup: (name: string) => NutriSource | null,
): RecipeNutri {
  const per: PerIngredientNutri[] = [];
  const total = { kcal: 0, p: 0, f: 0, c: 0 };
  let noValues = 0;
  let noAmount = 0;

  for (const ig of ings) {
    if (!ig.name?.trim()) continue;
    const entry = lookup(ig.name);

    if (!entry?.nutriPer100) {
      noValues++;
      per.push({ name: ig.name, kcal: null, p: 0, f: 0, c: 0, reason: "unknown" });
      continue;
    }

    const factor = scaleFactor(ig.amount, entry);
    if (factor === null) {
      noAmount++;
      per.push({ name: ig.name, kcal: null, p: 0, f: 0, c: 0, reason: "amount" });
      continue;
    }

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
      reason: null,
    });
  }

  const notes: string[] = [];
  if (noAmount) {
    notes.push(
      `${noAmount} Zutat(en) ohne verwertbare Menge — trag eine Menge ein (${UNIT_HINT}).`,
    );
  }
  if (noValues) {
    notes.push(
      `${noValues} Zutat(en) sind nicht in der Nährwerttabelle. Schreib den Namen etwas gängiger, oder lass sie weg.`,
    );
  }
  if (notes.length === 0) {
    notes.push(
      "Referenzwerte pro 100 g / Stück, hochgerechnet auf deine Mengen. Abweichung je nach Produkt realistisch ±10 %.",
    );
  }

  return {
    kcal: r0(total.kcal),
    p: r0(total.p),
    f: r0(total.f),
    c: r0(total.c),
    per,
    note: notes.join(" "),
  };
}

export function nutriLine(entry: LibraryEntry): string {
  if (!entry.nutriPer100) return "Nährwerte offen";
  const { kcal, p, f, c } = entry.nutriPer100;
  const basis = entry.basis === "stk" ? "/ Stück" : "/ 100 g";
  return `${kcal} kcal · ${p} g E · ${f} g F · ${c} g KH ${basis}`;
}

export function macroLine(n: { p: number; f: number; c: number }): string {
  return `${n.p} g E · ${n.f} g F · ${n.c} g KH`;
}
