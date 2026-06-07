"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { BrandHeader } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { apiFetch } from "@/lib/api";
import { parseRecoveryFromUrl } from "@/lib/recovery";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const result = parseRecoveryFromUrl();
    if (result.pending) return;

    if (result.error) {
      setError(
        result.error.includes("access_denied") || result.error.toLowerCase().includes("denied")
          ? "This reset link is invalid or has expired. Request a new link — and ensure /reset-password is added to Supabase redirect URLs."
          : result.error
      );
      setChecking(false);
      return;
    }

    if (!result.accessToken) {
      setError("No reset session found. Use the link from your email or request a new one.");
      setChecking(false);
      return;
    }

    setAccessToken(result.accessToken);
    setChecking(false);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!accessToken) {
      setError("Reset session expired. Request a new link.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ access_token: accessToken, password }),
      });
      setMessage("Password updated. You can sign in with your new password.");
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <BrandHeader
            logoSrc={BRAND_PATHS.welfareLogo}
            logoAlt={`${BRAND_COPY.name} logo`}
            title="Choose a new password"
            subtitle="Complete your password reset"
            size="lg"
            centered
          />
        </div>

        {checking ? (
          <p className="text-center text-sm text-slate-500">Verifying reset link…</p>
        ) : accessToken ? (
          <form onSubmit={handleSubmit} className="glass-card space-y-4 p-6 sm:p-8" aria-live="polite">
            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
                {message}
              </p>
            ) : null}

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3"
            >
              <KeyRound className="h-5 w-5" />
              {loading ? "Saving…" : "Update password"}
            </button>
          </form>
        ) : (
          <div className="glass-card space-y-4 p-6 sm:p-8">
            {error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}
            <Link href="/forgot-password" className="btn-primary block w-full py-3 text-center">
              Request a new reset link
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-semibold text-brand-navy hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
