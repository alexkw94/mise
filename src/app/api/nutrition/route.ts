import type Anthropic from "@anthropic-ai/sdk";
import { MODEL, aiUnavailable, getClient, parseJsonResponse } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

interface RequestIngredient {
  name: string;
  amount: string;
  /** Optional screenshot of the product's nutrition table. */
  shot?: { media_type: string; data: string };
}

interface EstimatedIngredient {
  name: string;
  basis: "100g" | "stk";
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  confidence: "screenshot" | "known" | "guess";
}

interface Estimate {
  ingredients: EstimatedIngredient[];
  note: string;
}

/**
 * The schema asks for per-100 g / per-piece values, NOT recipe totals.
 * Totals are computed client-side from these plus the user's amounts, so the
 * same ingredient stays correct when it is reused at a different quantity.
 */
const SCHEMA = {
  type: "object",
  properties: {
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          basis: {
            type: "string",
            enum: ["100g", "stk"],
            description:
              "'100g' for anything weighed or poured, 'stk' only for things counted as whole pieces (eggs, lemons, peppers).",
          },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          fat_g: { type: "number" },
          carbs_g: { type: "number" },
          confidence: { type: "string", enum: ["screenshot", "known", "guess"] },
        },
        required: ["name", "basis", "kcal", "protein_g", "fat_g", "carbs_g", "confidence"],
        additionalProperties: false,
      },
    },
    note: {
      type: "string",
      description:
        "One or two sentences in German on how reliable this estimate is and what would sharpen it.",
    },
  },
  required: ["ingredients", "note"],
  additionalProperties: false,
} as const;

const SYSTEM = `Du schätzt Nährwerte für eine private Kochapp aus der Schweiz.

Für jede Zutat lieferst du Werte pro 100 g — oder pro Stück, wenn die Zutat
sinnvollerweise in Stücken gezählt wird (Ei, Zitrone, Peperoni). Die Mengen aus
dem Rezept rechnest du NICHT hoch; das macht die App selbst.

Liegt ein Screenshot einer Nährwerttabelle bei, sind dessen Werte massgeblich —
lies sie ab, rechne sie bei Bedarf auf 100 g um, und setze confidence auf
"screenshot". Kennst du das Produkt gut, nimm "known". Rätst du, nimm "guess".

Gib für jede angefragte Zutat genau einen Eintrag zurück, mit exakt dem
Namen, der dir übergeben wurde.`;

export async function POST(req: Request) {
  // Validate before checking credentials, so a malformed request is reported
  // as a bad request rather than masked as an upstream outage.
  let ingredients: RequestIngredient[];
  try {
    const body = (await req.json()) as { ingredients?: RequestIngredient[] };
    ingredients = (body.ingredients ?? []).filter((i) => i?.name?.trim());
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (ingredients.length === 0) {
    return Response.json({ error: "no_ingredients" }, { status: 400 });
  }

  const client = getClient();
  if (!client) return aiUnavailable("ANTHROPIC_API_KEY not set");

  // Images first, then the text block naming them — matches the ordering the
  // vision docs recommend and keeps each screenshot next to its ingredient.
  const content: Anthropic.ContentBlockParam[] = [];
  for (const ing of ingredients) {
    if (!ing.shot) continue;
    content.push({
      type: "text",
      text: `Screenshot der Nährwerttabelle für: ${ing.name}`,
    });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: ing.shot.media_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: ing.shot.data,
      },
    });
  }
  content.push({
    type: "text",
    text: `Zutaten (Name — Menge im Rezept, nur als Kontext):\n${ingredients
      .map((i) => `- ${i.name} — ${i.amount || "Menge offen"}`)
      .join("\n")}`,
  });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    const estimate = parseJsonResponse<Estimate>(message);
    return Response.json(estimate);
  } catch (err) {
    console.error("[nutrition] estimate failed:", err);
    return aiUnavailable(err instanceof Error ? err.message : "unknown");
  }
}
