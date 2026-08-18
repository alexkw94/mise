import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only Anthropic client. The key is read from the environment and
 * never leaves the server — the browser talks to /api/* route handlers,
 * never to api.anthropic.com.
 */

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5";

let client: Anthropic | null = null;

export function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

/** Pull the single text block out of a structured-output response. */
export function parseJsonResponse<T>(message: Anthropic.Message): T {
  if (message.stop_reason === "refusal") {
    throw new Error("refusal");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("truncated");
  }
  const text = message.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("no text block");
  return JSON.parse(text.text) as T;
}

/**
 * The design has one shared failure state ("nicht erreichbar" card), so every
 * upstream problem collapses to the same shape. Status 503 tells the client
 * to render it; the detail is for the server log, not the user.
 */
export function aiUnavailable(reason: string) {
  return Response.json({ error: "ai_unavailable", reason }, { status: 503 });
}
