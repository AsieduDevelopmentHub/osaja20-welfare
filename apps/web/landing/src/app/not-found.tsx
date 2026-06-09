import { BRAND_COPY } from "@osaja/config";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-brand-gold">404</p>
      <h1 className="mt-2 text-2xl font-bold text-brand-navy">Page not found</h1>
      <p className="mt-2 max-w-md text-slate-600">
        This page does not exist on the {BRAND_COPY.name} {BRAND_COPY.welfare} site.
      </p>
      <Link href="/" className="btn-primary mt-8">
        Back to home
      </Link>
    </main>
  );
}
