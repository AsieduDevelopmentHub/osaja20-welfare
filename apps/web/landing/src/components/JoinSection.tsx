import { BRAND_COPY, LANDING_COPY } from "@osaja/config";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { aos } from "@/lib/aos";
import { portalUrls } from "@/lib/env";

export function JoinSection() {
  const { join } = LANDING_COPY;

  return (
    <section id="join" className="section-pad scroll-mt-20">
      <div className="mx-auto max-w-6xl">
        <div
          className="overflow-hidden rounded-[2rem] border border-brand-navy/10 bg-gradient-to-br from-white/80 via-brand-cream/90 to-brand-gold/15 p-8 shadow-glass backdrop-blur-sm sm:p-12"
          {...aos("fade-up", { duration: 800 })}
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-label">{BRAND_COPY.tagline}</p>
            <h2 className="section-title">{join.title}</h2>
            <p className="mt-4 text-slate-600">{join.body}</p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={portalUrls.member} className="btn-primary">
                {join.memberLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#gallery" className="btn-outline">
                Explore activities
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
