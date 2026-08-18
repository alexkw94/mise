"use client";

import { useState } from "react";
import { Screen, ScreenHeader, ScreenScroll } from "./Screen";
import { PANTRY_CHIPS } from "@/lib/seed";
import type { CookResult } from "@/lib/types";

type Status = "idle" | "loading" | "done" | "error";

export function CookTab({
  onAdopt,
}: {
  onAdopt: (result: CookResult) => void;
}) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<CookResult | null>(null);

  const items = input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function suggest() {
    if (status === "loading" || items.length === 0) return;
    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as CookResult);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Screen>
      <ScreenHeader kicker="Aus dem Kühlschrank" title="Was koch ich?" />

      <ScreenScroll extraBottom={20}>
        <div className="flex flex-col gap-4">
          <p
            style={{
              font: "400 15px/1.5 var(--font-sans)",
              color: "var(--color-muted)",
            }}
          >
            Was liegt herum? Tipp es ein — du bekommst ein konkretes Gericht
            plus die zwei, drei Dinge, die noch fehlen.
          </p>

          <textarea
            className="mlk-textarea min-h-[116px]"
            placeholder="z.B. Poulet, Zucchini, Reis, Zitrone, Joghurt"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Vorhandene Lebensmittel"
          />

          <div className="flex flex-wrap gap-2">
            {PANTRY_CHIPS.map((label) => (
              <button
                key={label}
                type="button"
                className="mlk-pantry-chip"
                onClick={() =>
                  setInput((v) => (v.trim() ? `${v}, ${label}` : label))
                }
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={suggest}
            disabled={status === "loading" || items.length === 0}
            className="mlk-btn-primary h-[54px] justify-start px-[22px]"
          >
            {status === "loading" ? "Sucht ein Gericht …" : "Rezept vorschlagen"}
          </button>

          {status === "loading" && (
            <div
              className="mlk-card-flat p-5"
              style={{ boxShadow: "0 12px 32px -16px rgba(20,22,28,.3)" }}
              aria-live="polite"
            >
              <div className="mlk-kicker">Denkt nach</div>
              <div className="mlk-skeleton mt-4 w-[82%]" />
              <div className="mlk-skeleton mt-[9px] w-[62%]" />
              <div className="mlk-skeleton mt-[9px] w-[72%]" />
            </div>
          )}

          {status === "error" && (
            <div
              className="p-4"
              style={{
                borderRadius: 18,
                border: "0.5px solid rgba(0,0,0,.1)",
                background: "rgba(255,255,255,.8)",
                font: "400 13px/1.5 var(--font-sans)",
                color: "var(--color-muted)",
              }}
              role="alert"
            >
              Der Vorschlag ist grad nicht erreichbar. Kein Drama — probier es
              gleich nochmal, deine Eingabe bleibt stehen.
            </div>
          )}

          {status === "done" && result && (
            <div
              className="mlk-card p-5"
              style={{
                background: "rgba(255,255,255,.74)",
                boxShadow:
                  "0 1px 1px rgba(0,0,0,.04), 0 16px 40px -18px rgba(20,22,28,.35)",
              }}
            >
              <div className="mlk-kicker" style={{ color: "var(--color-accent)" }}>
                Vorschlag
              </div>
              <h2
                className="mt-2.5"
                style={{
                  font: "600 25px/1.12 var(--font-sans)",
                  letterSpacing: "-0.026em",
                }}
              >
                {result.title}
              </h2>
              <p
                className="mt-3"
                style={{ font: "400 14.5px/1.55 var(--font-sans)" }}
              >
                {result.body}
              </p>
              <p
                className="mt-4 pt-3.5"
                style={{
                  borderTop: "0.5px solid rgba(0,0,0,.09)",
                  font: "400 12.5px/1.5 var(--font-sans)",
                  color: "var(--color-subtle)",
                }}
              >
                {result.missing}
              </p>
              <button
                type="button"
                onClick={() => onAdopt(result)}
                className="mlk-btn-secondary mt-[18px] h-12 justify-start px-5"
                style={{ border: "0.5px solid rgba(0,0,0,.12)" }}
              >
                In meine Rezepte übernehmen
              </button>
            </div>
          )}
        </div>
      </ScreenScroll>
    </Screen>
  );
}
