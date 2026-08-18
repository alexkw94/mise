"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { actions } from "@/lib/store";
import type { Basis, NutriSource } from "@/lib/nutrition";
import type { NutriPer } from "@/lib/types";

/** Accepts "3,6" as well as "3.6"; empty counts as 0. */
function num(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const fmt = (n: number | undefined | null) =>
  n === undefined || n === null ? "" : String(n);

/**
 * Enter or correct an ingredient's nutrition by hand.
 *
 * What is entered here is stored in the user's own library and from then on
 * beats the built-in table for that name — everywhere, in every recipe that
 * uses it. That is the point: the table holds generic reference values, and
 * this is how a specific product's label wins.
 */
export function NutritionSheet({
  name,
  current,
  onClose,
}: {
  name: string;
  /** Whatever currently resolves for this name, to prefill the form. */
  current: NutriSource | null;
  onClose: () => void;
}) {
  const [basis, setBasis] = useState<Basis>(current?.basis ?? "100g");
  const [kcal, setKcal] = useState(fmt(current?.nutriPer100?.kcal));
  const [p, setP] = useState(fmt(current?.nutriPer100?.p));
  const [f, setF] = useState(fmt(current?.nutriPer100?.f));
  const [c, setC] = useState(fmt(current?.nutriPer100?.c));
  const [perPiece, setPerPiece] = useState(fmt(current?.gramsPerPiece));

  const hasAny = [kcal, p, f, c].some((v) => v.trim() !== "");

  function save() {
    const values: NutriPer = { kcal: num(kcal), p: num(p), f: num(f), c: num(c) };
    const grams = perPiece.trim() ? num(perPiece) : null;
    actions.setLibraryNutrition(name, basis, values, grams || null);
    onClose();
  }

  function reset() {
    actions.clearLibraryNutrition(name);
    onClose();
  }

  const unit = basis === "stk" ? "Stück" : "100 g";

  return (
    <Sheet
      title={name}
      subtitle={`Nährwerte pro ${unit} — gilt danach in allen Rezepten mit dieser Zutat.`}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!hasAny}
            className="mlk-btn-primary mlk-t-label h-[52px] w-full"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={reset}
            className="mlk-btn-secondary mlk-t-label h-12 w-full"
          >
            Auf Tabellenwert zurücksetzen
          </button>
        </div>
      }
    >
      {/* Basis first: it changes what every number below means. */}
      <div className="mb-4">
        <div className="mlk-kicker mb-2">Angaben gelten pro</div>
        <div className="flex gap-2">
          {(["100g", "stk"] as Basis[]).map((b) => (
            <button
              key={b}
              type="button"
              className="mlk-cat"
              aria-pressed={basis === b}
              onClick={() => setBasis(b)}
            >
              {b === "100g" ? "100 g" : "Stück"}
            </button>
          ))}
        </div>
      </div>

      <div className="mlk-card p-3.5">
        {[
          ["Kalorien", "kcal", kcal, setKcal],
          ["Eiweiss", "g", p, setP],
          ["Fett", "g", f, setF],
          ["Kohlenhydrate", "g", c, setC],
        ].map(([label, suffix, value, setter]) => (
          <label
            key={label as string}
            className="mlk-row-divider flex items-center justify-between gap-3 py-2.5"
          >
            <span className="mlk-t-label">{label as string}</span>
            <span className="flex items-center gap-2">
              <input
                value={value as string}
                onChange={(e) =>
                  (setter as (v: string) => void)(e.target.value)
                }
                inputMode="decimal"
                placeholder="0"
                className="mlk-input w-[92px] text-right"
                style={{ height: 42, background: "rgba(255,255,255,.8)" }}
              />
              <span className="mlk-t-meta w-8">{suffix as string}</span>
            </span>
          </label>
        ))}
      </div>

      {basis === "100g" && (
        <label className="mt-3 flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="mlk-t-label block">Gewicht pro Stück</span>
            <span className="mlk-t-meta block">
              Optional — damit „2 Stk“ als Menge rechnen kann.
            </span>
          </span>
          <span className="flex flex-none items-center gap-2">
            <input
              value={perPiece}
              onChange={(e) => setPerPiece(e.target.value)}
              inputMode="decimal"
              placeholder="—"
              className="mlk-input w-[92px] text-right"
              style={{ height: 42, background: "rgba(255,255,255,.8)" }}
            />
            <span className="mlk-t-meta w-8">g</span>
          </span>
        </label>
      )}

      <p className="mlk-t-meta mt-4 px-1">
        Die Werte stehen meist auf der Packung. Steht dort eine andere
        Bezugsgrösse (z.B. „pro Portion“), rechne sie auf {unit} um.
      </p>
    </Sheet>
  );
}
