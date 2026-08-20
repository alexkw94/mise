import { fingerprint, mergeStates } from "./merge";
import { getState, replaceState } from "./store";
import type { AppState } from "./types";

/**
 * Sync through a private GitHub repository.
 *
 * The whole collection is one JSON file, read and written over the GitHub
 * contents API. Chosen over a database because it needs no new account, never
 * pauses, and gives version history for free: every save is a commit, so a
 * recipe deleted by accident is recoverable from the repo.
 *
 * Photos are not in here. They are uploaded to UploadThing and the recipe
 * carries the resulting URL, so a photo reaches the other device as part of
 * the ordinary text sync — no binaries in git, no repo that grows forever.
 *
 * The token is the user's own fine-grained PAT, scoped to this one repo. It
 * lives in localStorage on their devices and is sent only to api.github.com.
 */

const CONFIG_KEY = "mise:sync:v1";
const API = "https://api.github.com";

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
  // Tell the runner and the UI, so setting sync up starts it immediately
  // instead of only after the next full page load.
  setStatus(config ? { state: "idle" } : { state: "off" });
  emitStatus();
}

/* ---------------------------------------------------------------- status */

export type SyncState = "off" | "idle" | "syncing" | "ok" | "error";

export interface SyncStatus {
  state: SyncState;
  error?: string | null;
  at?: number | null;
}

/**
 * Observable status.
 *
 * Sync runs in the background, so without this the UI cannot tell "not set
 * up" from "working" from "failing every time" — they all look identical.
 * That ambiguity is worse than an outright failure, because nobody
 * investigates something that looks fine.
 */
let status: SyncStatus = { state: "off", error: null, at: null };
const statusListeners = new Set<() => void>();

function emitStatus() {
  for (const fn of statusListeners) fn();
}

export function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  emitStatus();
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(fn: () => void): () => void {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

/** Called once on boot so the first paint already knows the truth. */
export function initSyncStatus() {
  status = getConfig()
    ? { state: "idle", error: null, at: lastSyncAt() }
    : { state: "off", error: null, at: null };
  emitStatus();
}

export function lastSyncAt(): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem("mise:sync:last");
  return raw ? Number(raw) : null;
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

/* ---------------------------------------------------------------- public */

export interface SyncResult {
  pulled: number;
  pushed: boolean;
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
      return { pulled: merged.recipes.length, pushed: false };
    }

    try {
      await writeRemote(config, merged, remote.sha);
      return { pulled: merged.recipes.length, pushed: true };
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
