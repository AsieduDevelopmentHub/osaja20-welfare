import { BRAND_COPY, BRAND_PATHS, LANDING_COPY } from "@osaja/config";
import { BrandLogo } from "@osaja/ui";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { aos } from "@/lib/aos";
import { portalUrls } from "@/lib/env";

export function HeroSection() {
  const { hero } = LANDING_COPY;

  return (
    <section className="relative min-h-[100svh] overflow-hidden">
      <Image
        src={BRAND_PATHS.batchLogo}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-brand-navy-dark/95 via-brand-navy/88 to-brand-navy/75" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_80%_20%,rgba(201,162,39,0.22),transparent_55%)]" />

      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20 lg:justify-center lg:px-8 lg:pb-24 lg:pt-32">
        <div className="max-w-2xl" {...aos("fade-up", { duration: 900 })}>
          <div className="flex items-center gap-4">
            <BrandLogo
              src={BRAND_PATHS.welfareLogo}
              alt={`${BRAND_COPY.name} welfare logo`}
              size="lg"
              priority
              className="ring-2 ring-brand-gold/40"
            />
            <div>
              <p className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {BRAND_COPY.name}{" "}
                <span className="text-brand-gold-light">{BRAND_COPY.welfare}</span>
              </p>
              <p className="mt-1 text-sm font-medium text-slate-300 sm:text-base">{BRAND_COPY.batch}</p>
            </div>
          </div>

          <h1 className="mt-8 font-display text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-5xl">
            {hero.headline}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">
            {hero.subheadline}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={portalUrls.member} className="btn-gold">
              {hero.ctaMember}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#gallery" className="btn-outline-light">
              {hero.ctaGallery}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
