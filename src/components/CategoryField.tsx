"use client";

import { useMemo, useState } from "react";
import { SUGGESTED_CATEGORIES } from "@/lib/seed";

/**
 * Tag picker. Categories in use come first, then suggestions that are not yet
 * on this recipe, then a free-text field — a category is only ever a string,
 * so there is nothing to manage separately.
 */
export function CategoryField({
  selected,
  known,
  onChange,
}: {
  selected: string[];
  /** Categories already used somewhere in the collection. */
  known: string[];
  onChange: (next: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  const options = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...selected, ...known, ...SUGGESTED_CATEGORIES]) {
      const key = name.trim().toLowerCase();
      if (!name.trim() || seen.has(key)) continue;
      seen.add(key);
      out.push(name.trim());
    }
    return out;
  }, [selected, known]);

  const isOn = (name: string) =>
    selected.some((s) => s.toLowerCase() === name.toLowerCase());

  function toggle(name: string) {
    onChange(
      isOn(name)
        ? selected.filter((s) => s.toLowerCase() !== name.toLowerCase())
        : [...selected, name],
    );
  }

  function commit() {
    const name = value.trim();
    if (name && !isOn(name)) onChange([...selected, name]);
    setValue("");
    setAdding(false);
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((name) => (
        <button
          key={name}
          type="button"
          className="mlk-cat"
          aria-pressed={isOn(name)}
          onClick={() => toggle(name)}
        >
          {name}
        </button>
      ))}

      {adding ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setValue("");
              setAdding(false);
            }
          }}
          placeholder="Neue Kategorie"
          aria-label="Neue Kategorie"
          className="mlk-input"
          style={{ height: 34, width: 160, borderRadius: 100, fontSize: 13.5 }}
        />
      ) : (
        <button
          type="button"
          className="mlk-cat"
          style={{ borderStyle: "dashed", color: "var(--color-subtle)" }}
          onClick={() => setAdding(true)}
        >
          + Neu
        </button>
      )}
    </div>
  );
}
