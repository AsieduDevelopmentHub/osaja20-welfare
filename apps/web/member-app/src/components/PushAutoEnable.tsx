"use client";

import { useEffect, useRef } from "react";
import { getPushSubscriptionState, isPushSupported, subscribeToPush } from "@/lib/push";

/** Subscribe device to push on portal load when permission allows (users can disable in Settings). */
export function PushAutoEnable() {
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current || !isPushSupported()) return;
    tried.current = true;

    const run = async () => {
      if (Notification.permission === "denied") return;

      const state = await getPushSubscriptionState();
      if (state === "subscribed") return;

      await subscribeToPush();
    };

    run().catch(() => {
      /* User dismissed permission or VAPID not configured */
    });
  }, []);

  return null;
}
