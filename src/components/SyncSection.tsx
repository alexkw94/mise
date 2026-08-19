"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_CONFIG,
  getConfig,
  setConfig,
  syncNow,
  testConnection,
  type SyncConfig,
} from "@/lib/sync";

const TIME_KEY = "mise:sync:last";

function lastSyncLabel(): string {
  if (typeof localStorage === "undefined") return "";
  const raw = localStorage.getItem(TIME_KEY);
  if (!raw) return "noch nie";
  const d = new Date(Number(raw));
  return d.toLocaleString("de-CH", { dateStyle: "short", timeStyle: "short" });
}

/** Setup + manual sync, shown inside the collection sheet. */
export function SyncSection() {
  const [config, setLocal] = useState<SyncConfig | null>(null);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState(DEFAULT_CONFIG.repo);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState("");

  useEffect(() => {
    const c = getConfig();
    setLocal(c);
    if (c) {
      setOwner(c.owner);
      setRepo(c.repo);
    }
    setLast(lastSyncLabel());
  }, []);

  async function connect() {
    setBusy(true);
    setError(null);
    setNote(null);
    const candidate: SyncConfig = {
      owner: owner.trim(),
      repo: repo.trim(),
      path: DEFAULT_CONFIG.path,
      token: token.trim(),
    };
    try {
      const full = await testConnection(candidate);
      setConfig(candidate);
      setLocal(candidate);
      setToken("");
      setNote(`Verbunden mit ${full}.`);
      await run();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verbindung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await syncNow();
      localStorage.setItem(TIME_KEY, String(Date.now()));
      setLast(lastSyncLabel());
      setNote(
        res.pushed
          ? "Abgeglichen und hochgeladen."
          : "Abgeglichen — es gab nichts Neues zu senden.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Abgleich fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    setConfig(null);
    setLocal(null);
    setNote("Verbindung getrennt. Die Sammlung bleibt auf dem Gerät.");
  }

  if (config) {
    return (
      <div className="mlk-card p-4">
        <div className="mlk-kicker">Abgleich</div>
        <div className="mlk-t-body mt-2">
          {config.owner}/{config.repo}
        </div>
        <div className="mlk-t-meta mt-1">Zuletzt: {last}</div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="mlk-btn-primary mlk-t-label h-11 flex-1"
          >
            {busy ? "Gleicht ab …" : "Jetzt abgleichen"}
          </button>
          <button
            type="button"
            onClick={disconnect}
            className="mlk-btn-secondary mlk-t-label h-11 px-4"
          >
            Trennen
          </button>
        </div>

        {note && (
          <p className="mlk-t-sub mt-3" role="status" style={{ color: "var(--color-accent)" }}>
            {note}
          </p>
        )}
        {error && (
          <p className="mlk-t-sub mt-3" role="alert" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mlk-card p-4">
      <div className="mlk-kicker">Abgleich einrichten</div>
      <p className="mlk-t-sub mt-2" style={{ color: "var(--color-muted)" }}>
        Die Sammlung liegt in einem privaten GitHub-Repo. Auf jedem Gerät einmal
        eintragen — danach gleicht die App von selbst ab.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <input
          className="mlk-input"
          placeholder="GitHub-Benutzername"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="GitHub-Benutzername"
        />
        <input
          className="mlk-input"
          placeholder="Repo-Name"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="Repo-Name"
        />
        <input
          className="mlk-input"
          type="password"
          placeholder="Token (github_pat_…)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          aria-label="GitHub-Token"
        />
      </div>

      <button
        type="button"
        onClick={connect}
        disabled={busy || !owner.trim() || !repo.trim() || !token.trim()}
        className="mlk-btn-primary mlk-t-label mt-3 h-12 w-full"
      >
        {busy ? "Prüft …" : "Verbinden"}
      </button>

      {error && (
        <p className="mlk-t-sub mt-3" role="alert" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
      {note && (
        <p className="mlk-t-sub mt-3" role="status" style={{ color: "var(--color-accent)" }}>
          {note}
        </p>
      )}

      <p className="mlk-t-meta mt-3">
        Token erstellen auf github.com → Settings → Developer settings →
        Fine-grained tokens: nur dieses eine Repo, Berechtigung
        „Contents: Read and write“.
      </p>
    </div>
  );
}
