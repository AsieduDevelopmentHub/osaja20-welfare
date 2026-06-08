"use client";

import { FloatingContact, MobileShell, memberNavItems, PortalShellSkeleton } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/lib/auth";
import { getToken } from "@/lib/api";
import { env } from "@/lib/env";

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
          <div className="flex items-center gap-3">
            <ProfileAvatar member={member} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-brand-navy">{member.fullName}</p>
              <p className="truncate text-[10px] text-slate-500">{member.membershipId}</p>
            </div>
          </div>
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
      <FloatingContact
        variant="light"
        title={env.contact.title}
        note={env.contact.note}
        email={env.contact.email}
        phone={env.contact.phone}
        whatsappNumbers={env.contact.whatsappNumbers}
        whatsappMessage={env.contact.whatsappMessage}
      />
    </MobileShell>
  );
}
