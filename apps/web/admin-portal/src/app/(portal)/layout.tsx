"use client";

import { MobileShell, adminNavItems } from "@osaja/ui";

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileShell
      variant="dark"
      navItems={adminNavItems}
      brandTitle="OSAJA'20"
      brandSubtitle="Admin Portal"
      footer={
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs font-medium text-brand-400">Batch 2020 Leadership</p>
          <p className="text-xs text-slate-500">Executive & Admin access</p>
        </div>
      }
    >
      {children}
    </MobileShell>
  );
}
