"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/contributions", label: "Contributions", icon: "💰" },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
  { href: "/birthdays", label: "Birthdays", icon: "🎂" },
  { href: "/voting", label: "Voting", icon: "🗳️" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen gap-6 p-6">
      <aside className="glass-card flex h-full w-64 shrink-0 flex-col p-6">
        <div className="mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white shadow-md">
            O20
          </div>
          <h1 className="mt-3 text-lg font-bold text-slate-900">OSAJA&apos;20</h1>
          <p className="text-xs text-slate-500">Welfare Member Portal</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link flex items-center gap-3 ${active ? "nav-link-active" : ""}`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl bg-brand-50 p-4">
          <p className="text-xs font-medium text-brand-800">Batch 2020</p>
          <p className="text-xs text-brand-600">Asuofua D/A JHS Block A</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
