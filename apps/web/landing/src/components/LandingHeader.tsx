"use client";

import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { BrandLogo } from "@osaja/ui";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { portalUrls } from "@/lib/env";

const NAV = [
  { href: "#vision", label: "Vision" },
  { href: "#dream", label: "Our dream" },
  { href: "#pillars", label: "What we do" },
  { href: "#gallery", label: "Gallery" },
  { href: "#join", label: "Join us" },
] as const;

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-brand-navy/10 bg-white/90 shadow-sm backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#" className="flex min-w-0 items-center gap-3">
          <BrandLogo src={BRAND_PATHS.welfareLogo} alt={`${BRAND_COPY.name} logo`} size="sm" priority />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-brand-navy sm:text-base">
              {BRAND_COPY.name} {BRAND_COPY.welfare}
            </p>
            <p className="hidden truncate text-xs text-slate-500 sm:block">{BRAND_COPY.tagline}</p>
          </div>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-brand-navy/80 transition hover:bg-brand-navy/5 hover:text-brand-navy"
            >
              {item.label}
            </a>
          ))}
          <Link href={portalUrls.member} className="btn-gold ml-2 !py-2.5">
            Member portal
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-brand-navy md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-brand-navy/10 bg-white px-4 py-4 shadow-lg md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-3 text-sm font-medium text-brand-navy"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Link
              href={portalUrls.member}
              className="btn-gold mt-2 w-full"
              onClick={() => setOpen(false)}
            >
              Member portal
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
