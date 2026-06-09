import { BRAND_COPY, BRAND_PATHS, LANDING_COPY } from "@osaja/config";
import { BrandLogo } from "@osaja/ui";
import Link from "next/link";
import { portalUrls } from "@/lib/env";

const FOOTER_LINKS = [
  { href: "#vision", label: "Vision" },
  { href: "#dream", label: "Our dream" },
  { href: "#pillars", label: "What we do" },
  { href: "#gallery", label: "Gallery" },
] as const;

export function LandingFooter() {
  const { footer } = LANDING_COPY;

  return (
    <footer className="border-t border-brand-navy/10 bg-brand-navy-dark text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <BrandLogo src={BRAND_PATHS.welfareLogo} alt={`${BRAND_COPY.name} logo`} size="sm" />
              <div>
                <p className="font-bold text-white">
                  {BRAND_COPY.name} {BRAND_COPY.welfare}
                </p>
                <p className="text-xs text-slate-400">{BRAND_COPY.batch}</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed">{footer.tagline}</p>
            <p className="mt-2 text-sm text-brand-gold-light">{BRAND_COPY.motto}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">Explore</p>
            <ul className="mt-4 space-y-2 text-sm">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-gold">Portals</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link href={portalUrls.member} className="transition hover:text-white">
                  Member portal
                </Link>
              </li>
              <li>
                <Link href={portalUrls.admin} className="transition hover:text-white">
                  Admin portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          {footer.rights}
        </div>
      </div>
    </footer>
  );
}
