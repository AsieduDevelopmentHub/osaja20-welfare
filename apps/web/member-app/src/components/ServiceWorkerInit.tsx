"use client";

import { useEffect } from "react";

/** Register the service worker on load (offline shell + push). */
export function ServiceWorkerInit() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* non-fatal — push settings handles its own registration */
    });
  }, []);

  return null;
}
