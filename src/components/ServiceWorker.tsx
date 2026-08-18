"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/basePath";

/** Registers the service worker that makes "Zum Home-Bildschirm" behave. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`).catch(() => {
      // Registration failing only costs offline support; the app still runs.
    });
  }, []);
  return null;
}
