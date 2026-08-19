import type { AppState, LonglistItem, Recipe, Tombstones } from "./types";

/**
 * Merge two collections into one.
 *
 * Rules, in order of importance:
 *   1. Nothing is ever silently lost — an id present on either side survives
 *      unless it was explicitly deleted.
 *   2. A deletion counts only against records older than the deletion. Editing
 *      a recipe on one device after deleting it on the other brings it back,
 *      which is the safer of the two mistakes.
 *   3. Otherwise the newer `updatedAt` wins, per record, not per collection.
 *
 * The function is pure and order-independent: merge(a, b) equals merge(b, a).
 */

const stamp = (r: { updatedAt?: number; createdAt?: number }) =>
  r.updatedAt ?? r.createdAt ?? 0;

function mergeTombstones(a: Tombstones, b: Tombstones): Tombstones {
  const pick = (
    x: Record<string, number>,
    y: Record<string, number>,
  ): Record<string, number> => {
    const out: Record<string, number> = { ...x };
    for (const [id, ts] of Object.entries(y)) {
      out[id] = Math.max(out[id] ?? 0, ts);
    }
    return out;
  };
  return {
    recipes: pick(a.recipes ?? {}, b.recipes ?? {}),
    longlist: pick(a.longlist ?? {}, b.longlist ?? {}),
  };
}

type Timestamped = { id: string; updatedAt?: number; createdAt?: number };

function mergeById<T extends Timestamped>(
  a: T[],
  b: T[],
  graves: Record<string, number>,
): T[] {
  const byId = new Map<string, T>();
  for (const item of [...a, ...b]) {
    const seen = byId.get(item.id);
    if (!seen || stamp(item) > stamp(seen)) byId.set(item.id, item);
  }
  return [...byId.values()]
    .filter((item) => {
      const died = graves[item.id];
      // Kept when the record is newer than its own deletion (rule 2).
      return died === undefined || stamp(item) > died;
    })
    .sort((x, y) => stamp(y) - stamp(x));
}

export function mergeStates(a: AppState, b: AppState): AppState {
  const tombstones = mergeTombstones(
    a.tombstones ?? { recipes: {}, longlist: {} },
    b.tombstones ?? { recipes: {}, longlist: {} },
  );

  const library: AppState["library"] = { ...a.library };
  for (const [name, entry] of Object.entries(b.library ?? {})) {
    const mine = library[name];
    if (!mine || (entry.updatedAt ?? 0) > (mine.updatedAt ?? 0)) {
      library[name] = entry;
    }
  }

  return {
    recipes: mergeById<Recipe>(
      a.recipes ?? [],
      b.recipes ?? [],
      tombstones.recipes,
    ),
    longlist: mergeById<LonglistItem>(
      a.longlist ?? [],
      b.longlist ?? [],
      tombstones.longlist,
    ),
    library,
    removedLib: [...new Set([...(a.removedLib ?? []), ...(b.removedLib ?? [])])],
    tombstones,
  };
}

/** Cheap change detector, so an unchanged collection is not pushed. */
export function fingerprint(s: AppState): string {
  const parts = [
    ...s.recipes.map((r) => `${r.id}:${stamp(r)}`).sort(),
    ...s.longlist.map((l) => `${l.id}:${stamp(l)}`).sort(),
    ...Object.entries(s.library)
      .map(([n, e]) => `${n}:${e.updatedAt ?? 0}`)
      .sort(),
    ...Object.entries(s.tombstones.recipes).map(([i, t]) => `dr${i}:${t}`).sort(),
    ...Object.entries(s.tombstones.longlist).map(([i, t]) => `dl${i}:${t}`).sort(),
    ...[...s.removedLib].sort(),
  ];
  return parts.join("|");
}
