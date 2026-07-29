import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

/** Temporary scaffold screen until the feature is implemented. */
export function PlaceholderPage({ title, description, icon: Icon = Construction }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-brand-gold">SMS Portal</p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </header>

      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-12 text-center">
        <Icon className="mx-auto h-10 w-10 text-brand-gold" aria-hidden />
        <p className="mt-4 text-sm font-semibold text-white">Coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          This module is scaffolded and ready for Arkesel integration. Navigation and auth are live.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold-light"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
