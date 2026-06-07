"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail } from "lucide-react";
import { BrandHeader } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { apiFetch } from "@/lib/api";
import { resetPasswordRedirectUrl } from "@/lib/recovery";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), redirect_to: resetPasswordRedirectUrl() }),
      });
      setMessage(res.message ?? "Check your email for reset instructions.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
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
            title="Reset password"
            subtitle="We'll send instructions if your account exists"
            size="lg"
            centered
          />
        </div>

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
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 py-3"
          >
            <Mail className="h-5 w-5" />
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-semibold text-brand-navy hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
