"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { BrandHeader } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") ?? "").trim();

    try {
      const result = await register({
        full_name: fd.get("full_name"),
        email: fd.get("email"),
        password: fd.get("password"),
        phone_number: fd.get("phone_number"),
        date_of_birth: fd.get("date_of_birth"),
        ...(username ? { username } : {}),
        batch: 2020,
      });

      if (result.requiresEmailConfirmation) {
        setSuccess(result.message ?? "Check your email to confirm your account, then sign in.");
        return;
      }

      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <BrandHeader
            logoSrc={BRAND_PATHS.welfareLogo}
            logoAlt={`${BRAND_COPY.name} logo`}
            title={`Join ${BRAND_COPY.name}`}
            subtitle={BRAND_COPY.batch}
            size="lg"
            centered
          />
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-3 p-6 sm:p-8">
          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}
          {success ? (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p>{success}</p>
              <Link href="/login" className="mt-2 inline-block font-semibold text-brand-navy hover:underline">
                Go to sign in
              </Link>
            </div>
          ) : null}

          <input name="full_name" required placeholder="Full name" className={inputClass} />
          <input name="email" type="email" required placeholder="Email" className={inputClass} />
          <input
            name="username"
            placeholder="Username (optional — auto-assigned if blank)"
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9_]{3,30}"
            title="Lowercase letters, numbers, underscores only"
            className={inputClass}
          />
          <input name="password" type="password" required minLength={8} placeholder="Password (min 8)" className={inputClass} />
          <input name="phone_number" required placeholder="Phone number" className={inputClass} />
          <input name="date_of_birth" type="date" required className={inputClass} />

          <p className="text-xs text-slate-500">
            Your member ID will be assigned automatically after registration.
          </p>

          <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
            <UserPlus className="h-5 w-5" />
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-brand-navy hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
