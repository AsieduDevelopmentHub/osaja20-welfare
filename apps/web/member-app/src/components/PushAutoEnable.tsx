"use client";

import { useEffect, useRef } from "react";
import { getPushSubscriptionState, isPushSupported, subscribeToPush } from "@/lib/push";

/** Prompt for push permission once on portal load (users can disable in Settings). */
export function PushAutoEnable() {
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current || !isPushSupported()) return;
    tried.current = true;

    getPushSubscriptionState()
      .then((state) => {
        if (state === "prompt" && Notification.permission === "default") {
          return subscribeToPush();
        }
        return undefined;
      })
      .catch(() => {
        /* User denied or VAPID not configured */
      });
  }, []);

  return null;
}
