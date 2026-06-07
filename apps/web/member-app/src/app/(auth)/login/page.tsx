"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { BrandHeader, SkipLink } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <SkipLink />
      <main id="main-content" className="w-full max-w-md" tabIndex={-1}>
        <div className="mb-8">
          <BrandHeader
            logoSrc={BRAND_PATHS.welfareLogo}
            logoAlt={`${BRAND_COPY.name} logo`}
            title="Welcome back"
            subtitle={`Sign in to ${BRAND_COPY.name} ${BRAND_COPY.welfare}`}
            size="lg"
            centered
          />
          <p className="mt-4 text-center text-xs font-medium uppercase tracking-wider text-brand-gold-dark">
            {BRAND_COPY.tagline}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-4 p-6 sm:p-8">
          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          <div>
            <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email, username, or member ID
            </label>
            <input
              id="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder="e.g. you@email.com or OSA2020-00001"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-sm font-medium text-brand-navy hover:underline">
              Forgot password?
            </Link>
          </div>

          <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
            <LogIn className="h-5 w-5" />
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          No account?{" "}
          <Link href="/register" className="font-semibold text-brand-navy hover:underline">
            Register
          </Link>
        </p>
      </main>
    </div>
  );
}
