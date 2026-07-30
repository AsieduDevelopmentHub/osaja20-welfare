"use client";

import { useEffect } from "react";

/** Register the SMS portal service worker (offline shell + static cache). */
export function ServiceWorkerInit() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          registration.update().catch(() => {});
        })
        .catch(() => {
          /* non-fatal — SW requires HTTPS (or localhost) */
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
