"use client";

import { MobileShell, adminNavItems } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileShell
      variant="dark"
      navItems={adminNavItems}
      logoSrc={BRAND_PATHS.batchLogo}
      logoAlt={`${BRAND_COPY.batch} logo`}
      brandTitle={BRAND_COPY.name}
      brandSubtitle="Admin Portal"
      mobilePrimaryCount={4}
      footer={
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs font-medium text-brand-gold">{BRAND_COPY.motto}</p>
          <p className="mt-1 text-[10px] text-slate-500">Executive & Admin access</p>
        </div>
      }
    >
      {children}
    </MobileShell>
  );
}
