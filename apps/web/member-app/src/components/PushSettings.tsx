"use client";

import { BellRing, BellOff, Loader2, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getPushSubscriptionState,
  isPushSupported,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";

type PushState = "unsupported" | "denied" | "subscribed" | "prompt" | "loading";

export function PushSettings() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    setState("loading");
    try {
      setState(await getPushSubscriptionState());
    } catch {
      setState("prompt");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await subscribeToPush();
      setMessage("Push notifications enabled for this device.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable push");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await unsubscribeFromPush();
      setMessage("Push notifications disabled on this device.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable push");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await sendTestPush();
      setMessage("Test notification sent — check your device.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test push failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass-card p-5 sm:p-6">
      <h3 className="font-semibold text-slate-900">Browser push notifications</h3>
      <p className="mt-1 text-sm text-slate-500">
        Get instant alerts for dues, votes, announcements, and birthdays — even when the app is closed.
      </p>

      {state === "loading" ? (
        <p className="mt-4 text-sm text-slate-500">Checking push status…</p>
      ) : state === "unsupported" ? (
        <p className="mt-4 text-sm text-amber-700">This browser does not support Web Push.</p>
      ) : state === "denied" ? (
        <p className="mt-4 text-sm text-amber-700">
          Notifications are blocked. Allow them in your browser site settings, then reload this page.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {state === "subscribed" ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <BellRing className="h-3.5 w-3.5" />
                Enabled on this device
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={test}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send test
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={disable}
                className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <BellOff className="h-4 w-4" />
                Disable
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={enable}
              className="btn-primary flex items-center gap-2"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <BellRing className="h-5 w-5" />}
              Enable push notifications
            </button>
          )}
        </div>
      )}

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
