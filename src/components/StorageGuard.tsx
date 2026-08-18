"use client";

import { useEffect } from "react";

/**
 * Ask the browser to keep this site's storage.
 *
 * Safari clears script-writable storage (localStorage, IndexedDB) for sites
 * the user has not interacted with for seven days. Granted persistence takes
 * the collection out of that sweep. Safari grants it to home-screen web apps;
 * Chrome and Firefox decide by engagement. It is a request, not a guarantee —
 * which is why there is also a backup file, and why real sync is the only
 * complete answer.
 */
export function StorageGuard() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!navigator.storage?.persist) return;
    navigator.storage.persisted?.().then((already) => {
      if (!already) void navigator.storage.persist();
    });
  }, []);
  return null;
}

/** "granted" / "denied" / "unsupported" — shown in the backup sheet. */
export async function storageStatus(): Promise<
  "granted" | "denied" | "unsupported"
> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) {
    return "unsupported";
  }
  return (await navigator.storage.persisted()) ? "granted" : "denied";
}
