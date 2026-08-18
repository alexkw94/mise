"use client";

import { FEATURES } from "@/lib/features";
import type { TabKey } from "@/lib/types";

/**
 * The prototype drew placeholder squares here and its own notes list
 * "SF-Symbols-ähnliche Icons statt der Platzhalter" as the next step.
 * These are those icons; the active/inactive colour and glow treatment
 * is unchanged from the design.
 */
const ICONS: Record<TabKey, React.ReactNode> = {
  recipes: (
    <>
      <path d="M4 4.6A1.6 1.6 0 0 1 5.6 3h9.8A1.6 1.6 0 0 1 17 4.6v14.8l-6.5-3.3L4 19.4Z" />
    </>
  ),
  ingredients: (
    <>
      <path d="M10.5 3c3.6 0 6.5 2.9 6.5 6.5 0 4.4-3.6 8-6.5 9.5C7.6 17.5 4 13.9 4 9.5 4 5.9 6.9 3 10.5 3Z" />
      <path d="M10.5 6.5v6" />
      <path d="M8 9h5" />
    </>
  ),
  cook: (
    <>
      <path d="M3.5 9.5a7 7 0 0 1 14 0Z" />
      <path d="M2.5 9.5h16" />
      <path d="M5 13h11" />
      <path d="M6 16.5h9" />
    </>
  ),
  longlist: (
    <>
      <path d="M7.5 5.5h9" />
      <path d="M7.5 10.5h9" />
      <path d="M7.5 15.5h9" />
      <path d="M4 5.5h.01" />
      <path d="M4 10.5h.01" />
      <path d="M4 15.5h.01" />
    </>
  ),
};

const LABELS: Array<[TabKey, string]> = [
  ["recipes", "Rezepte"],
  ["ingredients", "Zutaten"],
  ["cook", "Was koch ich?"],
  ["longlist", "Merkliste"],
];

export function TabBar({
  active,
  onSelect,
}: {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
}) {
  // Disabled tabs drop out here; the grid sizes itself to whatever remains,
  // so re-enabling one in FEATURES needs no layout change.
  const tabs = LABELS.filter(([key]) => key !== "cook" || FEATURES.cookTab);

  return (
    <nav
      className="mlk-tabbar grid flex-none"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map(([key, label]) => {
        const on = key === active;
        const color = on ? "#1D1D1F" : "#A1A1A6";
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-current={on ? "page" : undefined}
            className="flex h-16 cursor-pointer flex-col items-center justify-center gap-1.5"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 21 22"
              fill="none"
              stroke={color}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{
                filter: on
                  ? "drop-shadow(0 4px 6px rgba(0,0,0,.35))"
                  : undefined,
              }}
            >
              {ICONS[key]}
            </svg>
            <span
              style={{
                font: "500 10.5px/1 var(--font-sans)",
                letterSpacing: "-0.005em",
                color,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
