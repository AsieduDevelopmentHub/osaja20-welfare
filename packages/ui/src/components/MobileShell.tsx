"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "./BrandLogo.js";
import type { NavItem } from "../nav-config.js";

export interface MobileShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
  logoSrc: string;
  logoAlt: string;
  brandTitle?: string;
  brandSubtitle?: string;
  footer?: React.ReactNode;
  variant?: "light" | "dark";
  /** Items shown in mobile bottom bar before "More" */
  mobilePrimaryCount?: number;
}

export function MobileShell({
  children,
  navItems,
  logoSrc,
  logoAlt,
  brandTitle = "OSAJA'20",
  brandSubtitle = "Welfare Portal",
  footer,
  variant = "light",
  mobilePrimaryCount = 4,
}: MobileShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isDark = variant === "dark";

  const primaryNav = navItems.slice(0, mobilePrimaryCount);
  const overflowNav = navItems.slice(mobilePrimaryCount);
  const hasOverflow = overflowNav.length > 0 || !!footer;

  const currentPage = useMemo(
    () => navItems.find((item) => item.href === pathname),
    [navItems, pathname]
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  const shellBg = isDark ? "bg-brand-navy-dark" : "bg-brand-cream";
  const cardBorder = isDark ? "border-white/10 bg-brand-navy/80" : "border-white/60 bg-white/80";
  const textMuted = isDark ? "text-slate-400" : "text-slate-500";

  const navLinkClass = (active: boolean) => {
    if (isDark) {
      return active
        ? "bg-brand-gold text-brand-navy-dark font-semibold"
        : "text-slate-300 hover:bg-white/10 hover:text-white";
    }
    return active
      ? "bg-brand-navy text-white font-semibold shadow-sm"
      : "text-slate-600 hover:bg-brand-blue/10 hover:text-brand-navy";
  };

  const bottomLinkClass = (active: boolean) =>
    active
      ? isDark
        ? "text-brand-gold"
        : "text-brand-navy"
      : isDark
        ? "text-slate-500"
        : "text-slate-400";

  const NavLink = ({
    item,
    onNavigate,
    compact = false,
  }: {
    item: NavItem;
    onNavigate?: () => void;
    compact?: boolean;
  }) => {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-xl transition-colors ${
          compact ? "flex-col gap-1 px-1 py-2" : "px-4 py-2.5 text-sm font-medium"
        } ${navLinkClass(active)}`}
      >
        <Icon className={`shrink-0 ${compact ? "h-5 w-5" : "h-5 w-5"}`} strokeWidth={active ? 2.25 : 1.75} />
        {!compact ? <span>{item.label}</span> : <span className="max-w-[4.5rem] truncate text-[10px] font-medium">{item.label.split(" ")[0]}</span>}
      </Link>
    );
  };

  return (
    <div className={`min-h-screen ${shellBg} ${isDark ? "text-slate-100" : "text-slate-900"}`}>
      {/* ── Mobile top bar (logo only — no duplicate menu) ── */}
      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-md lg:hidden ${cardBorder}`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <BrandHeader
            logoSrc={logoSrc}
            logoAlt={logoAlt}
            title={brandTitle}
            subtitle={currentPage?.label ?? brandSubtitle}
            size="sm"
            variant={variant}
          />
        </div>
      </header>

      {/* ── Desktop layout ── */}
      <div className="mx-auto flex max-w-7xl lg:gap-6 lg:p-6">
        <aside
          className={`sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col rounded-2xl border p-5 shadow-glass backdrop-blur-md lg:flex ${cardBorder}`}
        >
          <div className="mb-6">
            <BrandHeader
              logoSrc={logoSrc}
              logoAlt={logoAlt}
              title={brandTitle}
              subtitle={brandSubtitle}
              size="md"
              variant={variant}
            />
            {!isDark ? (
              <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-brand-gold-dark">
                Caring • Supporting • Uplifting
              </p>
            ) : null}
          </div>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>

          {footer ? <div className="mt-4 border-t border-white/10 pt-4">{footer}</div> : null}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:px-0 lg:py-0 lg:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav (single nav — no sidebar drawer) ── */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-30 border-t backdrop-blur-md lg:hidden ${cardBorder}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {primaryNav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 ${bottomLinkClass(active)}`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="max-w-full truncate px-0.5 text-[10px] font-medium">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}

          {hasOverflow ? (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 ${
                overflowNav.some((i) => i.href === pathname) ? bottomLinkClass(true) : bottomLinkClass(false)
              }`}
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-[10px] font-medium">More</span>
            </button>
          ) : null}
        </div>
      </nav>

      {/* ── Mobile "More" sheet (overflow routes + account) ── */}
      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className={`absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t p-5 shadow-2xl ${cardBorder}`}
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-brand-navy"}`}>More</p>
              <button type="button" onClick={() => setMoreOpen(false)} className={`rounded-lg p-1.5 ${textMuted}`}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {overflowNav.length > 0 ? (
              <nav className="mb-4 flex flex-col gap-1">
                {overflowNav.map((item) => (
                  <NavLink key={item.href} item={item} onNavigate={() => setMoreOpen(false)} />
                ))}
              </nav>
            ) : null}

            {footer ? <div className="border-t border-white/10 pt-4">{footer}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
