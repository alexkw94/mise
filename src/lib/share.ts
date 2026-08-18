import { macroLine } from "./nutrition";
import { BASE_PATH } from "./basePath";
import type { Recipe, ShareBundle } from "./types";

/**
 * Pragmatic sharing, no backend involved.
 *
 * A share is plain text (readable in WhatsApp, Mail, Signal, anywhere) plus a
 * link that carries the recipes in the URL itself. A friend who has the app
 * opens the link and gets an import prompt; a friend who doesn't still reads
 * the text. Nothing is uploaded anywhere.
 *
 * Photos are not included — they live in the sender's IndexedDB, and base64
 * images in a URL would be absurd. Recipients get the text and can shoot
 * their own photo.
 */

/** Links longer than this get dropped; the text is shared on its own. */
const MAX_URL_LENGTH = 8000;

/* ------------------------------------------------------------ encoding */

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function bundleFromRecipes(
  recipes: Recipe[],
  label: string | null,
): ShareBundle {
  return {
    v: 1,
    label,
    recipes: recipes.map((r) => ({
      title: r.title,
      body: r.body,
      categories: r.categories,
      ings: r.ings.map((i) => ({ name: i.name, amount: i.amount, url: i.url })),
    })),
  };
}

export function buildShareUrl(bundle: ShareBundle): string | null {
  if (typeof location === "undefined") return null;
  const url = `${location.origin}${BASE_PATH}/?r=${toBase64Url(JSON.stringify(bundle))}`;
  return url.length > MAX_URL_LENGTH ? null : url;
}

/** Reads the `?r=` parameter. Returns null when absent or unreadable. */
export function readShareParam(search: string): ShareBundle | null {
  const raw = new URLSearchParams(search).get("r");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as ShareBundle;
    if (parsed?.v !== 1 || !Array.isArray(parsed.recipes)) return null;
    return parsed;
  } catch {
    // Truncated or mangled link — better to ignore than to show an error the
    // recipient can do nothing about.
    return null;
  }
}

/* ---------------------------------------------------------------- text */

export function recipeToText(recipe: Recipe): string {
  const lines: string[] = [recipe.title];

  if (recipe.categories.length) {
    lines.push(recipe.categories.join(", "));
  }
  lines.push("");

  const ings = recipe.ings.filter((i) => i.name.trim());
  if (ings.length) {
    lines.push("Zutaten");
    for (const i of ings) {
      lines.push(`• ${[i.amount, i.name].filter(Boolean).join(" ")}`);
    }
    lines.push("");
  }

  if (recipe.body.trim()) lines.push("Zubereitung", recipe.body.trim(), "");

  if (recipe.nutri) {
    lines.push(
      `Nährwerte gesamt: ${recipe.nutri.kcal} kcal · ${macroLine(recipe.nutri)}`,
      "",
    );
  }

  return lines.join("\n").trimEnd();
}

export function bundleToText(recipes: Recipe[], label: string | null): string {
  const head = label
    ? `${label} — ${recipes.length} ${recipes.length === 1 ? "Rezept" : "Rezepte"}`
    : null;
  const body = recipes.map(recipeToText).join("\n\n———\n\n");
  return head ? `${head}\n\n${body}` : body;
}

/* --------------------------------------------------------------- share */

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/**
 * Native share sheet where there is one (every iPhone), clipboard everywhere
 * else. Returns what actually happened so the caller can confirm it.
 */
export async function shareRecipes(
  recipes: Recipe[],
  label: string | null,
): Promise<ShareOutcome> {
  if (recipes.length === 0) return "failed";

  const bundle = bundleFromRecipes(recipes, label);
  const url = buildShareUrl(bundle);
  const title = label ?? recipes[0].title;

  let text = bundleToText(recipes, label);
  if (url) text += `\n\nIn mise öffnen:\n${url}`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      // The URL rides inside `text`. Passing it as `url` too makes several
      // share targets drop the text and send only the link.
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      // The user dismissing the sheet is not a failure.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
