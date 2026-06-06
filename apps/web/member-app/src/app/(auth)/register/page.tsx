"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await register({
        full_name: fd.get("full_name"),
        email: fd.get("email"),
        password: fd.get("password"),
        phone_number: fd.get("phone_number"),
        date_of_birth: fd.get("date_of_birth"),
        membership_id: fd.get("membership_id"),
        batch: 2020,
      });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Join OSAJA&apos;20</h1>
          <p className="mt-1 text-sm text-slate-500">Create your welfare account</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card space-y-3 p-6 sm:p-8">
          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          <input name="full_name" required placeholder="Full name" className={inputClass} />
          <input name="email" type="email" required placeholder="Email" className={inputClass} />
          <input name="password" type="password" required minLength={8} placeholder="Password (min 8)" className={inputClass} />
          <input name="phone_number" required placeholder="Phone number" className={inputClass} />
          <input name="date_of_birth" type="date" required className={inputClass} />
          <input name="membership_id" required placeholder="Membership ID (e.g. OSA-001)" className={inputClass} />

          <button type="submit" disabled={loading} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
            <UserPlus className="h-5 w-5" />
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
