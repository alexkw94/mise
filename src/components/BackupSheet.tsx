"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { Logo } from "./Logo";
import { storageStatus } from "./StorageGuard";
import { SyncSection } from "./SyncSection";
import { downloadBackup, readBackup, restoreImages } from "@/lib/backup";
import { actions, useStore } from "@/lib/store";

const kb = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function BackupSheet({ onClose }: { onClose: () => void }) {
  const state = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<string>("…");

  useEffect(() => {
    storageStatus().then((s) =>
      setPersisted(
        s === "granted"
          ? "Dauerhaft — der Browser räumt die Daten nicht von selbst weg."
          : s === "denied"
            ? "Nicht garantiert. Als App auf dem Home-Bildschirm ist es deutlich sicherer."
            : "Von diesem Browser nicht meldbar.",
      ),
    );
  }, []);

  async function exportAll() {
    setBusy(true);
    setError(null);
    try {
      const size = await downloadBackup(state);
      setNote(`Sicherung erstellt (${kb(size)}).`);
    } catch {
      setError("Die Sicherung konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function importAll(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const backup = await readBackup(file);
      const images = await restoreImages(backup);
      const added = actions.mergeState(backup.state);
      setNote(
        `${added.recipes} Rezept(e), ${added.longlist} Merklisten-Eintrag/-Einträge und ${images} Bild(er) übernommen.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      brand={<Logo size={17} />}
      title="Sammlung"
      subtitle="Abgleich zwischen Geräten und Sicherung als Datei."
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={exportAll}
            disabled={busy}
            className="mlk-btn-primary mlk-t-label h-[52px] w-full"
          >
            {busy ? "Einen Moment …" : "Sicherung herunterladen"}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="mlk-btn-secondary mlk-t-label h-12 w-full"
          >
            Sicherung einlesen
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={importAll}
          />
        </div>
      }
    >
      <SyncSection />

      <div className="mlk-card mt-3 p-4">
        <div className="mlk-kicker">Aktuell gespeichert</div>
        <div className="mlk-t-body mt-2">
          {state.recipes.length}{" "}
          {state.recipes.length === 1 ? "Rezept" : "Rezepte"} ·{" "}
          {state.longlist.length} auf der Merkliste
        </div>
      </div>

      <div className="mlk-card mt-3 p-4">
        <div className="mlk-kicker">Speicher auf diesem Gerät</div>
        <p className="mlk-t-sub mt-2" style={{ color: "var(--color-muted)" }}>
          {persisted}
        </p>
      </div>

      {note && (
        <p className="mlk-t-sub mt-3 px-1" role="status" style={{ color: "var(--color-accent)" }}>
          {note}
        </p>
      )}
      {error && (
        <p className="mlk-t-sub mt-3 px-1" role="alert" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}

      <p className="mlk-t-meta mt-4 px-1">
        Einlesen ergänzt, es überschreibt nichts: Rezepte, die es hier schon
        gibt, bleiben unverändert. So lässt sich eine Sicherung auch nutzen, um
        die Sammlung auf ein zweites Gerät zu bringen.
      </p>
    </Sheet>
  );
}
