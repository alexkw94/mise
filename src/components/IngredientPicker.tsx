"use client";

import { useMemo, useState } from "react";
import { Sheet } from "./Sheet";
import { StoredImage } from "./StoredImage";
import { nutriLine } from "@/lib/nutrition";
import type { LibraryEntry } from "@/lib/types";

/**
 * Pick straight from the ingredient library instead of retyping names.
 * Multi-select, because adding five ingredients one sheet at a time would be
 * worse than typing them.
 */
export function IngredientPicker({
  library,
  alreadyUsed,
  onAdd,
  onClose,
}: {
  library: LibraryEntry[];
  /** Names already on the recipe — shown, but not selectable twice. */
  alreadyUsed: string[];
  onAdd: (entries: LibraryEntry[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const used = useMemo(
    () => new Set(alreadyUsed.map((n) => n.trim().toLowerCase())),
    [alreadyUsed],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return library;
    return library.filter((x) => x.name.toLowerCase().includes(term));
  }, [library, q]);

  function toggle(name: string) {
    setPicked((p) =>
      p.includes(name) ? p.filter((n) => n !== name) : [...p, name],
    );
  }

  function confirm() {
    const entries = library.filter((x) => picked.includes(x.name));
    if (entries.length) onAdd(entries);
    onClose();
  }

  return (
    <Sheet
      title="Zutat auswählen"
      subtitle="Aus deiner Bibliothek — Link und Nährwerte kommen mit."
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={confirm}
          disabled={picked.length === 0}
          className="mlk-btn-primary mlk-t-label h-[52px] w-full"
        >
          {picked.length === 0
            ? "Nichts ausgewählt"
            : `${picked.length} ${picked.length === 1 ? "Zutat" : "Zutaten"} übernehmen`}
        </button>
      }
    >
      <input
        className="mlk-input sticky top-0 z-10 mb-3"
        type="search"
        placeholder="Zutat suchen"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Zutat suchen"
        autoFocus
      />

      <div className="mlk-card overflow-hidden">
        {filtered.map((entry) => {
          const isUsed = used.has(entry.name.toLowerCase());
          const isPicked = picked.includes(entry.name);
          return (
            <button
              key={entry.name}
              type="button"
              disabled={isUsed}
              aria-pressed={isPicked}
              onClick={() => toggle(entry.name)}
              className="mlk-row-divider flex w-full items-center gap-3.5 px-4 py-3 text-left disabled:opacity-45"
            >
              <span
                className="flex h-[26px] w-[26px] flex-none items-center justify-center"
                style={{
                  borderRadius: 100,
                  border: `1px solid ${isPicked ? "#1D1D1F" : "rgba(0,0,0,.2)"}`,
                  background: isPicked
                    ? "linear-gradient(180deg,#4A4A4D,#1D1D1F)"
                    : "rgba(255,255,255,.7)",
                  font: "500 13px/1 var(--font-sans)",
                  color: "#fff",
                }}
                aria-hidden="true"
              >
                {isPicked ? "✓" : ""}
              </span>

              <span
                className="mlk-plate flex h-11 w-11 flex-none items-center justify-center"
                style={{
                  borderRadius: 12,
                  border: "0.5px solid rgba(255,255,255,.9)",
                  background: "linear-gradient(145deg,#F7F8FA,#DEE1E6)",
                }}
              >
                <StoredImage
                  id={entry.shotId}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </span>

              <span className="min-w-0 flex-1">
                <span className="mlk-t-label mlk-truncate block">
                  {entry.name}
                </span>
                <span className="mlk-t-meta mlk-truncate mt-0.5 block">
                  {isUsed ? "Schon im Rezept" : nutriLine(entry)}
                </span>
              </span>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="mlk-t-sub px-[18px] py-6" style={{ color: "var(--color-subtle)" }}>
            {library.length === 0
              ? "Deine Bibliothek ist noch leer. Sie füllt sich, sobald du Zutaten in Rezepten erfasst — tipp sie hier einfach von Hand ein."
              : "Keine Zutat mit diesem Namen."}
          </p>
        )}
      </div>
    </Sheet>
  );
}
