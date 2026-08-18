import { MODEL, aiUnavailable, getClient, parseJsonResponse } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Suggestion {
  title: string;
  body: string;
  missing: string;
  ingredients: string[];
}

const SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Name des Gerichts, kurz und konkret.",
    },
    body: {
      type: "string",
      description:
        "Zubereitung als zusammenhängender Fliesstext, 3–6 Sätze. Keine Aufzählung, keine Überschriften.",
    },
    missing: {
      type: "string",
      description:
        "Ein Satz: was für eine ausgewogene Mahlzeit noch fehlt. Höchstens zwei, drei Dinge.",
    },
    ingredients: {
      type: "array",
      items: { type: "string" },
      description:
        "Alle Zutaten des Gerichts als Namen, damit die App daraus ein Rezept anlegen kann.",
    },
  },
  required: ["title", "body", "missing", "ingredients"],
  additionalProperties: false,
} as const;

const SYSTEM = `Du schlägst genau EIN konkretes Gericht vor, das sich aus den
vorhandenen Lebensmitteln kochen lässt. Die Person kocht gern und gut, steht in
einer normalen Schweizer Küche und will in etwa 30 Minuten essen.

Halte dich an das, was da ist. Salz, Pfeffer, Öl, Butter, Zwiebeln und
Knoblauch darfst du voraussetzen. Erfinde keine Spezialzutaten dazu — was
fehlt, gehört ins Feld "missing", nicht in die Zubereitung.

Schreib die Zubereitung als Fliesstext, so wie man es jemandem am Herd
erklären würde: konkrete Handgriffe, Reihenfolge, worauf es ankommt. Keine
Nummerierung, keine Mengenlisten im Text.

Antworte auf Deutsch.`;

export async function POST(req: Request) {
  // Validate before checking credentials, so a malformed request is reported
  // as a bad request rather than masked as an upstream outage.
  let items: string[];
  try {
    const body = (await req.json()) as { items?: string[] };
    items = (body.items ?? []).map((s) => String(s).trim()).filter(Boolean);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (items.length === 0) {
    return Response.json({ error: "no_items" }, { status: 400 });
  }

  const client = getClient();
  if (!client) return aiUnavailable("ANTHROPIC_API_KEY not set");

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Das liegt herum: ${items.join(", ")}.\n\nWas koch ich?`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });

    const suggestion = parseJsonResponse<Suggestion>(message);
    return Response.json(suggestion);
  } catch (err) {
    console.error("[suggest] failed:", err);
    return aiUnavailable(err instanceof Error ? err.message : "unknown");
  }
}
