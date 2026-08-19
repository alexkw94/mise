import { fingerprint, mergeStates } from "./merge";
import { getState, replaceState } from "./store";
import { getImage, listImageIds, putImage } from "./idb";
import type { AppState } from "./types";

/**
 * Sync through a private GitHub repository.
 *
 * The whole collection is one JSON file, read and written over the GitHub
 * contents API. Chosen over a database because it needs no new account, never
 * pauses, and gives version history for free: every save is a commit, so a
 * recipe deleted by accident is recoverable from the repo.
 *
 * Photos travel too, but separately: the JSON stays small and text-only, and
 * each image is its own file under `images/`. That way a 400 KB photo is not
 * re-uploaded every time a recipe title changes, and an image that fails to
 * transfer costs one photo rather than the whole collection.
 *
 * The token is the user's own fine-grained PAT, scoped to this one repo. It
 * lives in localStorage on their devices and is sent only to api.github.com.
 */

const CONFIG_KEY = "mise:sync:v1";
const API = "https://api.github.com";
const IMAGE_DIR = "images";

export interface SyncConfig {
  owner: string;
  repo: string;
  path: string;
  token: string;
}

export const DEFAULT_CONFIG: Omit<SyncConfig, "token"> = {
  owner: "",
  repo: "mise-data",
  path: "collection.json",
};

export function getConfig(): SyncConfig | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as SyncConfig;
    return c.owner && c.repo && c.token ? { ...DEFAULT_CONFIG, ...c } : null;
  } catch {
    return null;
  }
}

export function setConfig(config: SyncConfig | null) {
  if (typeof localStorage === "undefined") return;
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  else localStorage.removeItem(CONFIG_KEY);
}

/* ------------------------------------------------------------ base64 utf-8 */

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function decode(b64: string): string {
  const clean = b64.replace(/\s/g, "");
  const binary = atob(clean);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (ch) => ch.charCodeAt(0)),
  );
}

/* ----------------------------------------------------------------- wire */

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export class SyncError extends Error {}

function explain(status: number): string {
  switch (status) {
    case 401:
      return "Das Token wird nicht akzeptiert. Abgelaufen oder falsch kopiert?";
    case 403:
      return "Zugriff verweigert. Hat das Token „Contents: Read and write“ für dieses Repo?";
    case 404:
      return "Repo oder Datei nicht gefunden. Stimmen Benutzername und Repo-Name?";
    case 409:
      return "Gleichzeitige Änderung — bitte nochmal versuchen.";
    default:
      return `GitHub antwortete mit ${status}.`;
  }
}

interface RemoteFile {
  state: AppState | null;
  sha: string | null;
}

async function readRemote(c: SyncConfig): Promise<RemoteFile> {
  const url = `${API}/repos/${c.owner}/${c.repo}/contents/${c.path}`;
  const res = await fetch(url, { headers: headers(c.token) });

  // No file yet — a fresh repo. Not an error; the first push creates it.
  if (res.status === 404) return { state: null, sha: null };
  if (!res.ok) throw new SyncError(explain(res.status));

  const body = (await res.json()) as {
    content?: string;
    encoding?: string;
    sha: string;
    download_url?: string;
  };

  // Files over 1 MB come back without inline content.
  let text: string;
  if (body.encoding === "base64" && body.content) {
    text = decode(body.content);
  } else if (body.download_url) {
    const raw = await fetch(body.download_url, { headers: headers(c.token) });
    if (!raw.ok) throw new SyncError(explain(raw.status));
    text = await raw.text();
  } else {
    throw new SyncError("Die Datei konnte nicht gelesen werden.");
  }

  try {
    const parsed = JSON.parse(text) as Partial<AppState> & { app?: string };
    return { state: normalise(parsed), sha: body.sha };
  } catch {
    throw new SyncError("Die Datei im Repo ist kein gültiges mise-JSON.");
  }
}

/** Fill in anything an older or hand-edited file is missing. */
function normalise(p: Partial<AppState>): AppState {
  return {
    recipes: (p.recipes ?? []).map((r) => ({ ...r, categories: r.categories ?? [] })),
    longlist: p.longlist ?? [],
    library: p.library ?? {},
    removedLib: p.removedLib ?? [],
    tombstones: p.tombstones ?? { recipes: {}, longlist: {} },
  };
}

async function writeRemote(
  c: SyncConfig,
  state: AppState,
  sha: string | null,
): Promise<string> {
  const payload = {
    app: "mise",
    v: 1,
    updatedAt: new Date().toISOString(),
    ...state,
  };
  const url = `${API}/repos/${c.owner}/${c.repo}/contents/${c.path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers(c.token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `mise: ${state.recipes.length} Rezepte, ${state.longlist.length} auf der Merkliste`,
      content: encode(JSON.stringify(payload, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new SyncError(explain(res.status));
  const body = (await res.json()) as { content?: { sha?: string } };
  return body.content?.sha ?? "";
}

/* ---------------------------------------------------------------- images */

/** Every image id the collection actually points at. */
function referencedImages(state: AppState): Set<string> {
  const ids = new Set<string>();
  for (const r of state.recipes) {
    if (r.photoId) ids.add(r.photoId);
    for (const i of r.ings) if (i.shotId) ids.add(i.shotId);
  }
  for (const l of state.longlist) if (l.imageId) ids.add(l.imageId);
  return ids;
}

/** Remote image id → blob sha. Missing directory is normal on a fresh repo. */
async function listRemoteImages(c: SyncConfig): Promise<Set<string>> {
  const res = await fetch(
    `${API}/repos/${c.owner}/${c.repo}/contents/${IMAGE_DIR}`,
    { headers: headers(c.token) },
  );
  if (res.status === 404) return new Set();
  if (!res.ok) throw new SyncError(explain(res.status));
  const body = (await res.json()) as Array<{ name: string; type: string }>;
  return new Set(
    body
      .filter((e) => e.type === "file")
      .map((e) => e.name.replace(/\.[^.]+$/, "")),
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function uploadImage(c: SyncConfig, id: string): Promise<void> {
  const blob = await getImage(id);
  if (!blob) return;
  const res = await fetch(
    `${API}/repos/${c.owner}/${c.repo}/contents/${IMAGE_DIR}/${id}.jpg`,
    {
      method: "PUT",
      headers: { ...headers(c.token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `mise: Bild ${id}`,
        content: await blobToBase64(blob),
      }),
    },
  );
  // 422 means it already exists with different content — leave the remote as
  // the winner rather than overwriting someone else's photo.
  if (!res.ok && res.status !== 422) throw new SyncError(explain(res.status));
}

async function downloadImage(c: SyncConfig, id: string): Promise<void> {
  const res = await fetch(
    `${API}/repos/${c.owner}/${c.repo}/contents/${IMAGE_DIR}/${id}.jpg`,
    { headers: { ...headers(c.token), Accept: "application/vnd.github.raw" } },
  );
  if (!res.ok) throw new SyncError(explain(res.status));
  const blob = await res.blob();
  await putImage(id, blob.type ? blob : new Blob([blob], { type: "image/jpeg" }));
}

export interface ImageSyncResult {
  uploaded: number;
  downloaded: number;
}

/**
 * Move photos in both directions. Runs after the JSON, so the remote list of
 * referenced ids is already the merged one.
 *
 * A single failing image is swallowed on purpose: a photo that will not
 * transfer must not abort the sync of everything else.
 */
async function syncImages(
  c: SyncConfig,
  state: AppState,
): Promise<ImageSyncResult> {
  const wanted = referencedImages(state);
  if (wanted.size === 0) return { uploaded: 0, downloaded: 0 };

  const [remote, localList] = await Promise.all([
    listRemoteImages(c),
    listImageIds().catch(() => [] as string[]),
  ]);
  const local = new Set(localList);

  let uploaded = 0;
  let downloaded = 0;

  for (const id of wanted) {
    try {
      if (local.has(id) && !remote.has(id)) {
        await uploadImage(c, id);
        uploaded++;
      } else if (!local.has(id) && remote.has(id)) {
        await downloadImage(c, id);
        downloaded++;
      }
    } catch {
      // One photo short is survivable; a failed sync is not.
    }
  }

  return { uploaded, downloaded };
}

/* ---------------------------------------------------------------- public */

export interface SyncResult {
  pulled: number;
  pushed: boolean;
  images: ImageSyncResult;
}

/**
 * One round: read remote, merge into local, write back if anything changed.
 * A 409 means the other device wrote in between — re-read and retry once,
 * which is why the merge has to be order-independent.
 */
export async function syncNow(): Promise<SyncResult> {
  const config = getConfig();
  if (!config) throw new SyncError("Sync ist nicht eingerichtet.");

  for (let attempt = 0; attempt < 2; attempt++) {
    const before = getState();
    const remote = await readRemote(config);

    const merged = remote.state ? mergeStates(before, remote.state) : before;
    const localChanged = fingerprint(merged) !== fingerprint(before);
    if (localChanged) replaceState(merged);

    const remoteChanged =
      !remote.state || fingerprint(merged) !== fingerprint(remote.state);

    if (!remoteChanged) {
      const images = await syncImages(config, merged);
      return { pulled: merged.recipes.length, pushed: false, images };
    }

    try {
      await writeRemote(config, merged, remote.sha);
      const images = await syncImages(config, merged);
      return { pulled: merged.recipes.length, pushed: true, images };
    } catch (err) {
      const conflict =
        err instanceof SyncError && err.message.includes("Gleichzeitige");
      if (!conflict || attempt === 1) throw err;
      // Loop once more against the newer remote.
    }
  }

  throw new SyncError("Abgleich nach zwei Versuchen nicht möglich.");
}

/** Cheap credential check for the setup form. */
export async function testConnection(c: SyncConfig): Promise<string> {
  const res = await fetch(`${API}/repos/${c.owner}/${c.repo}`, {
    headers: headers(c.token),
  });
  if (!res.ok) throw new SyncError(explain(res.status));
  const body = (await res.json()) as {
    full_name: string;
    private: boolean;
    permissions?: { push?: boolean };
  };
  if (!body.permissions?.push) {
    throw new SyncError(
      "Das Token darf nur lesen. „Contents: Read and write“ nötig.",
    );
  }
  if (!body.private) {
    throw new SyncError(
      "Dieses Repo ist öffentlich — deine Rezepte wären für alle sichtbar.",
    );
  }
  return body.full_name;
}
