"use client";

import { MobileShell, memberNavItems, PortalShellSkeleton } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { getToken } from "@/lib/api";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { member, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!member || !getToken())) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, member, router, pathname]);

  if (loading) {
    return <PortalShellSkeleton variant="light" />;
  }

  if (!member || !getToken()) return null;

  return (
    <MobileShell
      navItems={memberNavItems}
      logoSrc={BRAND_PATHS.welfareLogo}
      logoAlt={`${BRAND_COPY.name} ${BRAND_COPY.welfare} logo`}
      brandTitle={BRAND_COPY.name}
      brandSubtitle="Member Portal"
      mobilePrimaryCount={4}
      footer={
        <div className="rounded-xl bg-brand-navy/5 p-4">
          <p className="truncate text-xs font-semibold text-brand-navy">{member.fullName}</p>
          <p className="truncate text-[10px] text-slate-500">{member.membershipId}</p>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="mt-2 text-xs font-semibold text-brand-gold-dark hover:underline"
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
