"use client";

import { FloatingContact, MobileShell, PortalShellSkeleton, smsNavItems } from "@osaja/ui";
import { BRAND_COPY, BRAND_PATHS } from "@osaja/config";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { env } from "@/lib/env";

export default function SmsPortalLayout({ children }: { children: React.ReactNode }) {
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
      navItems={smsNavItems}
      logoSrc={BRAND_PATHS.batchLogo}
      logoAlt={`${BRAND_COPY.batch} logo`}
      brandTitle={BRAND_COPY.name}
      brandSubtitle="SMS Portal"
      mobilePrimaryCount={4}
      footer={
        <div className="rounded-xl bg-white/5 p-4">
          <p className="truncate text-xs font-semibold text-white">{member.fullName}</p>
          <p className="truncate text-[10px] capitalize text-brand-gold">{member.role}</p>
          <p className="truncate text-[10px] text-slate-500">{member.email}</p>
          <Link
            href={env.adminPortalUrl}
            className="mt-2 block text-xs font-semibold text-brand-gold hover:underline"
          >
            Open admin portal
          </Link>
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
      <FloatingContact
        variant="dark"
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
