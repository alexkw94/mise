"use client";

import { useMemo, useState } from "react";
import { Screen, ScreenHeader, ScreenScroll } from "./Screen";
import { StoredImage } from "./StoredImage";
import { NutritionSheet } from "./NutritionSheet";
import { nutriLine } from "@/lib/nutrition";
import { actions } from "@/lib/store";
import type { LibraryEntry } from "@/lib/types";

export function IngredientsTab({
  library,
  q,
  onQ,
}: {
  library: LibraryEntry[];
  q: string;
  onQ: (v: string) => void;
}) {
  const [editing, setEditing] = useState<LibraryEntry | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return library;
    return library.filter((x) => x.name.toLowerCase().includes(term));
  }, [library, q]);

  return (
    <Screen>
      <ScreenHeader kicker="Baut sich selbst auf" title="Zutaten">
        <input
          className="mlk-input mt-4"
          type="search"
          placeholder="Zutat suchen"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          aria-label="Zutat suchen"
        />
      </ScreenHeader>

      <ScreenScroll extraBottom={20}>
        <div className="mlk-card overflow-hidden">
          {filtered.map((entry) => (
            <div
              key={entry.name}
              className="mlk-row-divider flex items-center gap-3.5 px-4 py-3.5"
            >
              <div
                className="mlk-plate flex h-[52px] w-[52px] flex-none items-center justify-center"
                style={{
                  borderRadius: 14,
                  border: "0.5px solid rgba(255,255,255,.9)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)",
                  background: "linear-gradient(145deg,#F7F8FA,#DEE1E6)",
                }}
              >
                <StoredImage
                  id={entry.shotId}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {!entry.shotId && (
                  <span
                    style={{
                      font: "500 9px/1 var(--font-sans)",
                      letterSpacing: "0.1em",
                      color: "var(--color-subtle)",
                    }}
                  >
                    —
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="mlk-truncate"
                  style={{
                    font: "500 16.5px/1.2 var(--font-sans)",
                    letterSpacing: "-0.018em",
                  }}
                >
                  {entry.name}
                </div>

                {/* The nutrition line is the edit affordance: tapping it opens
                    the form, whether values exist yet or not. A plain button,
                    so the link below stays valid markup. */}
                <button
                  type="button"
                  onClick={() => setEditing(entry)}
                  className="mlk-truncate mt-1 block max-w-full text-left"
                  style={{
                    font: "400 12px/1.4 var(--font-sans)",
                    color: entry.nutriPer100
                      ? "var(--color-subtle)"
                      : "var(--color-accent)",
                  }}
                >
                  {entry.nutriPer100
                    ? `${nutriLine(entry)} · ändern`
                    : "Werte eintragen →"}
                </button>

                {entry.url ? (
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mlk-truncate mt-[3px] block"
                    style={{
                      font: "400 11.5px/1.4 var(--font-sans)",
                      color: "var(--color-accent)",
                    }}
                  >
                    {entry.url.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <div
                    className="mlk-truncate mt-[3px]"
                    style={{
                      font: "400 11.5px/1.4 var(--font-sans)",
                      color: "var(--color-faint)",
                    }}
                  >
                    {entry.uses.length > 1
                      ? `in ${entry.uses.length} Rezepten`
                      : `in „${entry.uses[0]}“`}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="mlk-icon-btn"
                aria-label={`${entry.name} aus der Bibliothek entfernen`}
                onClick={() => actions.removeFromLibrary(entry.name)}
              >
                ✕
              </button>
            </div>
          ))}

          {filtered.length === 0 && (
            <p
              className="px-[18px] py-[26px]"
              style={{
                font: "400 14px/1.5 var(--font-sans)",
                color: "var(--color-subtle)",
              }}
            >
              {library.length === 0
                ? "Die Bibliothek füllt sich von selbst, sobald du Zutaten in Rezepten erfasst."
                : "Keine Zutat mit diesem Namen."}
            </p>
          )}
        </div>
      </ScreenScroll>

      {editing && (
        <NutritionSheet
          name={editing.name}
          current={{
            basis: editing.basis,
            nutriPer100: editing.nutriPer100,
            gramsPerPiece: editing.gramsPerPiece ?? null,
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </Screen>
  );
}
