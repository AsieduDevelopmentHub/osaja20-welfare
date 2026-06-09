import Link from "next/link";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { BrandHeader } from "@osaja/ui";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-navy-dark px-4 py-8 text-white">
      <div className="w-full max-w-md text-center">
        <BrandHeader
          logoSrc={BRAND_PATHS.welfareLogo}
          logoAlt={`${BRAND_COPY.name} ${BRAND_COPY.welfare} logo`}
          title={BRAND_COPY.name}
          subtitle="Admin Portal"
          size="md"
          variant="dark"
        />

        <p className="mt-8 text-6xl font-bold tracking-tight text-white/15" aria-hidden>
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-slate-300">
          This admin route does not exist. If you lost connection, you may see the offline screen instead — that is
          not the same as a missing page.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-5 py-3 text-sm font-semibold text-brand-navy-dark hover:bg-brand-gold/90"
          >
            <Home className="h-4 w-4" aria-hidden />
            Go to dashboard
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
