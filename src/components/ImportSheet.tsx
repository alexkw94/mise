"use client";

import { Sheet } from "./Sheet";
import { Logo } from "./Logo";
import type { Recipe, ShareBundle } from "@/lib/types";

/**
 * Shown when the app is opened via a share link (`/?r=…`). Nothing is written
 * until the recipient confirms — a link should never silently change someone
 * else's collection.
 */
export function ImportSheet({
  bundle,
  onImport,
  onDismiss,
}: {
  bundle: ShareBundle;
  onImport: () => void;
  onDismiss: () => void;
}) {
  const count = bundle.recipes.length;

  return (
    <Sheet
      // A share link is often someone's first contact with the app, so this
      // is the one sheet that introduces it by name.
      brand={<Logo size={17} />}
      title={bundle.label ?? "Geteiltes Rezept"}
      subtitle={
        count === 1
          ? "Jemand hat dir ein Rezept geschickt."
          : `Jemand hat dir ${count} Rezepte geschickt.`
      }
      onClose={onDismiss}
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onImport}
            className="mlk-btn-primary mlk-t-label h-[52px] w-full"
          >
            {count === 1
              ? "Rezept übernehmen"
              : `Alle ${count} übernehmen`}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="mlk-btn-secondary mlk-t-label h-12 w-full"
          >
            Verwerfen
          </button>
        </div>
      }
    >
      <div className="mlk-card overflow-hidden">
        {bundle.recipes.map((r, i) => (
          <div key={i} className="mlk-row-divider px-4 py-3.5">
            <div className="mlk-t-label">{r.title || "Ohne Titel"}</div>
            <div className="mlk-t-meta mt-1">
              {[
                `${r.ings.filter((x) => x.name).length} Zutaten`,
                r.categories.join(", ") || null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        ))}
      </div>

      <p className="mlk-t-meta mt-3 px-1">
        Fotos kommen mit, sofern sie hochgeladen wurden. Ein Foto, das nur auf
        dem Gerät des Absenders liegt, lässt sich nicht mitschicken.
      </p>
    </Sheet>
  );
}

/** Turn a received bundle into recipes this device owns. */
export function bundleToRecipes(
  bundle: ShareBundle,
  makeId: () => string,
): Recipe[] {
  const now = Date.now();
  return bundle.recipes.map((r) => ({
    id: makeId(),
    title: r.title,
    body: r.body,
    categories: r.categories ?? [],
    photoUrl: r.photoUrl ?? null,
    photoId: null,
    ings: (r.ings ?? []).map((i) => ({
      name: i.name,
      amount: i.amount,
      url: i.url,
      shotId: null,
    })),
    // Left null on purpose: values are recomputed from the recipient's own
    // library, which may differ from the sender's.
    nutri: null,
    createdAt: now,
    updatedAt: now,
  }));
}
