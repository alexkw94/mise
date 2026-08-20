"use client";

import { useSyncExternalStore } from "react";
import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from "@/lib/sync";

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    subscribeSyncStatus,
    getSyncStatus,
    () => ({ state: "off" }) as SyncStatus,
  );
}

const COLOR: Record<string, string> = {
  off: "#A1A1A6",
  idle: "#A1A1A6",
  syncing: "#0071E3",
  ok: "#34A853",
  error: "#C7362B",
};

/**
 * A dot on the collection button. Small on purpose — the point is only that
 * "not set up" and "failing" stop looking exactly like "fine".
 */
export function SyncDot() {
  const { state } = useSyncStatus();
  if (state === "idle" || state === "ok") return null;

  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 6,
        right: 4,
        width: 8,
        height: 8,
        borderRadius: 100,
        background: COLOR[state] ?? COLOR.off,
        boxShadow: "0 0 0 2px rgba(255,255,255,.9)",
      }}
    />
  );
}

export function syncLabel(status: SyncStatus): string {
  switch (status.state) {
    case "off":
      return "Nicht eingerichtet";
    case "syncing":
      return "Gleicht ab …";
    case "error":
      return status.error ?? "Abgleich fehlgeschlagen";
    case "ok":
    case "idle":
    default:
      return status.at
        ? `Zuletzt ${new Date(status.at).toLocaleString("de-CH", {
            dateStyle: "short",
            timeStyle: "short",
          })}`
        : "Bereit";
  }
}
