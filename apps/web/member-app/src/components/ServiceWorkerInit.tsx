"use client";

import { useEffect } from "react";

/** Register the service worker on load (offline shell + push). */
export function ServiceWorkerInit() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch(() => {
        /* non-fatal */
      });
  }, []);

  return null;
}
