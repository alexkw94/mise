"use client";

import { useEffect } from "react";
import { getConfig, syncNow } from "@/lib/sync";
import { fingerprint } from "@/lib/merge";
import { getState, subscribeStore } from "@/lib/store";

const IDLE_MS = 4000;

/**
 * Keeps the collection in step without the user thinking about it: once when
 * the app opens, when it comes back to the foreground, and a few seconds after
 * the last edit.
 *
 * Two things stop this from looping: a sync writes to the store itself, so a
 * run in progress ignores store events, and a run is skipped when the
 * fingerprint has not moved since the last successful one.
 */
export function SyncRunner() {
  useEffect(() => {
    if (!getConfig()) return;

    let running = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSynced = "";
    let disposed = false;

    async function run(reason: string) {
      if (disposed || running || !getConfig()) return;
      if (fingerprint(getState()) === lastSynced) return;
      running = true;
      try {
        await syncNow();
        lastSynced = fingerprint(getState());
        localStorage.setItem("mise:sync:last", String(Date.now()));
      } catch {
        // Offline, token expired, GitHub down — the collection stays usable
        // and the sheet shows the error on the next manual attempt.
        void reason;
      } finally {
        running = false;
      }
    }

    void run("start");

    const unsubscribe = subscribeStore(() => {
      if (running) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run("edit"), IDLE_MS);
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") void run("foreground");
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
