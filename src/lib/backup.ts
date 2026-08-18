import { getImage, listImageIds, putImage } from "./idb";
import type { AppState } from "./types";

/**
 * Whole-collection backup as a single file.
 *
 * Two jobs: a safety net against the browser clearing its storage, and a way
 * to carry a collection to another device without a server. Images are
 * included — a backup that silently drops the photos is not a backup.
 */

const FILE_VERSION = 1;

export interface BackupFile {
  app: "mise";
  v: number;
  exportedAt: string;
  state: AppState;
  /** IndexedDB image id → data URL. */
  images: Record<string, string>;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return await (await fetch(url)).blob();
}

export async function buildBackup(state: AppState): Promise<BackupFile> {
  const images: Record<string, string> = {};
  // Only ids the state actually references — orphans are not worth carrying.
  const referenced = new Set<string>();
  for (const r of state.recipes) {
    if (r.photoId) referenced.add(r.photoId);
    for (const i of r.ings) if (i.shotId) referenced.add(i.shotId);
  }
  for (const l of state.longlist) if (l.imageId) referenced.add(l.imageId);

  const present = new Set(await listImageIds().catch(() => []));
  for (const id of referenced) {
    if (!present.has(id)) continue;
    const blob = await getImage(id).catch(() => undefined);
    if (blob) images[id] = await blobToDataUrl(blob);
  }

  return {
    app: "mise",
    v: FILE_VERSION,
    exportedAt: new Date().toISOString(),
    state,
    images,
  };
}

export async function downloadBackup(state: AppState): Promise<number> {
  const backup = await buildBackup(state);
  const json = JSON.stringify(backup);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `mise-sicherung-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke late; Safari needs the URL alive while the download starts.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return blob.size;
}

export interface RestoreResult {
  recipes: number;
  longlist: number;
  images: number;
}

/** Parse and validate a backup file. Throws with a readable message. */
export async function readBackup(file: File): Promise<BackupFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("Die Datei ist keine gültige mise-Sicherung.");
  }
  const b = parsed as Partial<BackupFile>;
  if (b?.app !== "mise" || !b.state || !Array.isArray(b.state.recipes)) {
    throw new Error("Die Datei ist keine gültige mise-Sicherung.");
  }
  if ((b.v ?? 0) > FILE_VERSION) {
    throw new Error(
      "Die Sicherung stammt aus einer neueren Version von mise.",
    );
  }
  return b as BackupFile;
}

/** Write the images back into IndexedDB. State is applied by the store. */
export async function restoreImages(backup: BackupFile): Promise<number> {
  let n = 0;
  for (const [id, dataUrl] of Object.entries(backup.images ?? {})) {
    try {
      await putImage(id, await dataUrlToBlob(dataUrl));
      n++;
    } catch {
      // A single unreadable image must not abort the whole restore.
    }
  }
  return n;
}
