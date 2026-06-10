import { BRAND_COPY, BRAND_PATHS, LANDING_COPY } from "@osaja/config";
import { BrandLogo } from "@osaja/ui";
import { ArrowRight, Heart, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { aos } from "@/lib/aos";
import { portalUrls } from "@/lib/env";

export function HeroSection() {
  const { hero } = LANDING_COPY;

  return (
    <section className="relative overflow-hidden pt-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(43,108,176,0.18),transparent)]" />
      <div className="absolute -right-24 top-24 h-72 w-72 rounded-full bg-brand-gold/10 blur-3xl" />
      <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-brand-blue/10 blur-3xl" />

      <div className="section-pad relative mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div {...aos("fade-right", { duration: 800 })}>
            <p className="section-label">{hero.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-brand-navy sm:text-5xl lg:text-6xl">
              {hero.headline}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">{hero.subheadline}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href={portalUrls.member} className="btn-primary">
                {hero.ctaMember}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#gallery" className="btn-outline">
                {hero.ctaGallery}
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-navy/10 text-brand-navy">
                  <Heart className="h-4 w-4" />
                </span>
                <span>{BRAND_COPY.tagline}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold-dark">
                  <Users className="h-4 w-4" />
                </span>
                <span>Batch {BRAND_COPY.batch.split(" ").pop()}</span>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none" {...aos("fade-left", { delay: 150, duration: 900 })}>
            <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/60 p-6 shadow-hero backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-navy via-brand-blue to-brand-gold" />
              <div className="flex flex-col items-center text-center">
                <BrandLogo
                  src={BRAND_PATHS.welfareLogo}
                  alt={`${BRAND_COPY.name} welfare logo`}
                  size="xl"
                  priority
                  className="ring-4 ring-brand-gold/20"
                />
                <p className="mt-5 text-2xl font-bold text-brand-navy">
                  {BRAND_COPY.name} {BRAND_COPY.welfare}
                </p>
                <p className="mt-2 text-sm font-medium text-brand-gold-dark">{BRAND_COPY.motto}</p>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{BRAND_COPY.batch}</p>
              </div>
              <div className="mt-6 overflow-hidden rounded-2xl">
                <Image
                  src={BRAND_PATHS.batchLogo}
                  alt={`${BRAND_COPY.batch} logo`}
                  width={480}
                  height={320}
                  className="h-40 w-full object-cover object-center sm:h-48"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
