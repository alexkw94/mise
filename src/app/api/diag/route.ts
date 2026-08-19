/**
 * TEMPORARY diagnostic for the UploadThing token.
 *
 * Reports the *shape* of the value, never the value: length, the first three
 * characters (a type marker like "eyJ" or "sk_", not secret material), and
 * which of the common paste mistakes are present. Delete this route once the
 * token is working — it is a debugging aid, not part of the app.
 */
export const runtime = "nodejs";

export async function GET() {
  const raw = process.env.UPLOATHING_TOKEN ?? process.env.UPLOADTHING_TOKEN;

  if (!raw) {
    return Response.json({
      present: false,
      hint: "UPLOADTHING_TOKEN ist in dieser Umgebung nicht gesetzt.",
      otherUploadthingVars: Object.keys(process.env).filter((k) =>
        k.toUpperCase().includes("UPLOAD"),
      ),
    });
  }

  const trimmed = raw.trim().replace(/^["']|["']$/g, "");

  let decodes = false;
  let jsonKeys: string[] = [];
  try {
    const text = Buffer.from(trimmed, "base64").toString("utf8");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    decodes = true;
    jsonKeys = Object.keys(parsed);
  } catch {
    decodes = false;
  }

  return Response.json({
    present: true,
    length: raw.length,
    prefix: raw.slice(0, 3),
    // The classic paste mistakes:
    hasSurroundingQuotes: /^["']|["']$/.test(raw.trim()),
    hasWhitespace: /\s/.test(raw),
    containsVariableName: raw.toUpperCase().includes("UPLOADTHING_TOKEN"),
    decodesAsBase64Json: decodes,
    jsonKeys,
    verdict: decodes
      ? jsonKeys.includes("apiKey") && jsonKeys.includes("appId")
        ? "sieht korrekt aus"
        : "dekodiert, aber die erwarteten Felder fehlen"
      : "lässt sich nicht als Base64-JSON lesen",
  });
}
