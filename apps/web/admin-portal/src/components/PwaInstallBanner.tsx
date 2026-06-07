"use client";

import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { Download, Share, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "osaja-admin-pwa-install-dismissed";
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"native" | "ios" | "manual">("native");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently()) return;

    let manualTimer: number | undefined;
    let gotNative = false;

    const onBip = (e: Event) => {
      e.preventDefault();
      gotNative = true;
      if (manualTimer) window.clearTimeout(manualTimer);
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("native");
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);

    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isIos()) {
      setMode("ios");
      setVisible(true);
    } else if (mobile) {
      manualTimer = window.setTimeout(() => {
        if (!gotNative && !isStandalone() && !wasDismissedRecently()) {
          setMode("manual");
          setVisible(true);
        }
      }, 5000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      if (manualTimer) window.clearTimeout(manualTimer);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      dismiss();
      return;
    }
    dismiss();
  }, [deferred, dismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 mx-auto max-w-lg lg:bottom-6 lg:left-auto lg:right-6"
      role="region"
      aria-label="Install app"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-brand-navy/10 bg-white p-4 shadow-xl ring-1 ring-black/5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-navy">
          <img src={BRAND_PATHS.batchLogo} alt="" className="h-8 w-8 rounded-lg object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-brand-navy">
            Install {BRAND_COPY.name} Admin
          </p>
          {mode === "ios" ? (
            <p className="mt-1 text-sm text-slate-600">
              Tap <Share className="inline h-4 w-4 align-text-bottom" aria-hidden /> Share, then{" "}
              <strong>Add to Home Screen</strong> for quick access on the go.
            </p>
          ) : mode === "native" ? (
            <p className="mt-1 text-sm text-slate-600">
              Add the admin portal to your home screen for faster executive access.
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              Use your browser menu (<strong>Install app</strong> or <strong>Add to Home screen</strong>) to install.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {mode === "native" ? (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-sm font-semibold text-white"
              >
                <Download className="h-4 w-4" aria-hidden />
                Install
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss install prompt"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
