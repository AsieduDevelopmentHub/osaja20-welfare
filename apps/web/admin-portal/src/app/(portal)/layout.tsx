"use client";

import { MobileShell, adminNavItems, PortalShellSkeleton } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const { member, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!member || !getToken())) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, member, router, pathname]);

  if (loading) {
    return <PortalShellSkeleton variant="dark" />;
  }

  if (!member || !getToken()) return null;

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
          <p className="truncate text-xs font-semibold text-white">{member.fullName}</p>
          <p className="truncate text-[10px] capitalize text-brand-gold">{member.role}</p>
          <p className="truncate text-[10px] text-slate-500">{member.email}</p>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="mt-2 text-xs font-semibold text-brand-gold hover:underline"
          >
            Sign out
          </button>
        </div>
      }
    >
      {children}
    </MobileShell>
  );
}
