"use client";

import { useEffect } from "react";
import {
  getConfig,
  initSyncStatus,
  setStatus,
  subscribeSyncStatus,
  syncNow,
} from "@/lib/sync";
import { fingerprint } from "@/lib/merge";
import { getState, subscribeStore } from "@/lib/store";

const IDLE_MS = 4000;

/**
 * Keeps the collection in step without the user thinking about it: when the
 * app opens, when it returns to the foreground, and a few seconds after the
 * last edit.
 *
 * It also has to start the moment sync is *configured*. An earlier version
 * checked the config once on mount and gave up if it was missing — which it
 * always is, because you set sync up after the app has loaded. Automatic sync
 * then never ran until a full reload, and on a home-screen app that can be
 * days. Hence the subscription rather than a one-off check.
 */
export function SyncRunner() {
  useEffect(() => {
    initSyncStatus();

    let running = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastSynced = "";
    let disposed = false;

    async function run() {
      if (disposed || running || !getConfig()) return;
      if (fingerprint(getState()) === lastSynced) return;

      running = true;
      setStatus({ state: "syncing", error: null });
      try {
        await syncNow();
        lastSynced = fingerprint(getState());
        const at = Date.now();
        localStorage.setItem("mise:sync:last", String(at));
        setStatus({ state: "ok", error: null, at });
      } catch (err) {
        // Surfaced now rather than swallowed: a sync that quietly fails every
        // time is indistinguishable from one that works.
        setStatus({
          state: "error",
          error: err instanceof Error ? err.message : "Abgleich fehlgeschlagen.",
        });
      } finally {
        running = false;
      }
    }

    const schedule = () => {
      if (running) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), IDLE_MS);
    };

    void run();

    const unsubscribeStore = subscribeStore(schedule);

    // Reacts to sync being configured (or dropped) while the app is open —
    // but only to an actual change of configuration. Reacting to every status
    // change would turn a persistent failure into a retry loop, because
    // failing sets the status, which would trigger another attempt.
    const configKey = () => {
      const c = getConfig();
      return c ? `${c.owner}/${c.repo}/${c.path}/${c.token.length}` : "";
    };
    let seenConfig = configKey();
    const unsubscribeStatus = subscribeSyncStatus(() => {
      const now = configKey();
      if (now === seenConfig) return;
      seenConfig = now;
      lastSynced = "";
      if (now) void run();
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      unsubscribeStore();
      unsubscribeStatus();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
