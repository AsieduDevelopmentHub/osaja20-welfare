"use client";

import { useEffect, useRef } from "react";
import { getPushSubscriptionState, isPushSupported, subscribeToPush } from "@/lib/push";

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
      /* permission denied or VAPID not configured */
    });
  }, []);

  return null;
}
