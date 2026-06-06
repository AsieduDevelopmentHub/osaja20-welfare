"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { NavItem } from "../nav-config.js";

export interface MobileShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
  brandTitle?: string;
  brandSubtitle?: string;
  brandBadge?: string;
  footer?: React.ReactNode;
  variant?: "light" | "dark";
}

export function MobileShell({
  children,
  navItems,
  brandTitle = "OSAJA'20",
  brandSubtitle = "Welfare Portal",
  brandBadge = "O20",
  footer,
  variant = "light",
}: MobileShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isDark = variant === "dark";

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const linkClass = (active: boolean) => {
    if (isDark) {
      return active
        ? "bg-brand-600 text-white"
        : "text-slate-300 hover:bg-slate-800 hover:text-white";
    }
    return active ? "bg-brand-600 text-white shadow-md" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700";
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {navItems.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${linkClass(active)}`}
          >
            <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  const bottomNav = navItems.slice(0, 5);

  return (
    <div className={`min-h-screen ${isDark ? "bg-slate-950 text-slate-100" : ""}`}>
      {/* Mobile header */}
      <header
        className={`sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 backdrop-blur-md lg:hidden ${
          isDark ? "border-slate-800 bg-slate-950/90" : "border-slate-200/60 bg-white/80"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            {brandBadge}
          </div>
          <div>
            <p className={`text-sm font-bold leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              {brandTitle}
            </p>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{brandSubtitle}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
          className={`rounded-xl p-2 ${isDark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu overlay"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className={`absolute left-0 top-0 flex h-full w-[min(100%,280px)] flex-col p-5 shadow-2xl ${
              isDark ? "bg-slate-900" : "bg-white"
            }`}
          >
            <div className="mb-6 flex items-center justify-between">
              <p className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>Menu</p>
              <button type="button" onClick={() => setMenuOpen(false)} className="rounded-lg p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </nav>
            {footer ? <div className="mt-auto pt-6">{footer}</div> : null}
          </aside>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-7xl gap-6 lg:p-6">
        {/* Desktop sidebar */}
        <aside
          className={`hidden w-64 shrink-0 flex-col rounded-2xl border p-6 lg:flex ${
            isDark
              ? "border-slate-700/50 bg-slate-850/80 shadow-glass"
              : "border-white/40 bg-white/70 shadow-glass backdrop-blur-md"
          }`}
        >
          <div className="mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-md">
              {brandBadge}
            </div>
            <h1 className={`mt-3 text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              {brandTitle}
            </h1>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{brandSubtitle}</p>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            <NavLinks />
          </nav>
          {footer ? <div className="mt-auto">{footer}</div> : null}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 pb-24 lg:px-0 lg:py-0 lg:pb-0">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-30 border-t px-1 py-1 lg:hidden ${
          isDark ? "border-slate-800 bg-slate-950/95" : "border-slate-200/80 bg-white/95"
        } backdrop-blur-md`}
      >
        <div className="mx-auto flex max-w-lg justify-around">
          {bottomNav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium sm:text-xs ${
                  active
                    ? "text-brand-600"
                    : isDark
                      ? "text-slate-400"
                      : "text-slate-500"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                <span className="truncate">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
