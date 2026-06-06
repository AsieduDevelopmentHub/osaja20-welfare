"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Shield } from "lucide-react";
import { AuthFormSkeleton, BrandHeader } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { useAuth } from "@/lib/auth";

function AdminLoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

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
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <BrandHeader
            logoSrc={BRAND_PATHS.batchLogo}
            logoAlt={`${BRAND_COPY.batch} logo`}
            title="Admin Portal"
            subtitle={`${BRAND_COPY.name} ${BRAND_COPY.welfare}`}
            size="lg"
            centered
            variant="dark"
          />
          <p className="mt-4 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-brand-gold">
            <Shield className="h-3.5 w-3.5" />
            Executive & administrator access only
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-white/10 bg-brand-navy/80 p-6 shadow-glass backdrop-blur-md sm:p-8"
        >
          {error ? (
            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
          ) : null}

          <div>
            <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-slate-300">
              Email, username, or member ID
            </label>
            <input
              id="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder="admin@osaja.com or OSA2020-00001"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-gold py-3 font-semibold text-brand-navy-dark transition hover:bg-brand-gold-light disabled:opacity-60"
          >
            <LogIn className="h-5 w-5" />
            {loading ? "Signing in..." : "Sign in to admin"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Member portal?{" "}
          <a
            href="http://localhost:3000/login"
            className="font-semibold text-brand-gold hover:underline"
          >
            Sign in as member
          </a>
        </p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4 py-8">
          <AuthFormSkeleton variant="dark" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
