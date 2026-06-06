"use client";

import { MobileShell, memberNavItems } from "@osaja/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { member, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !member) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, member, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!member) return null;

  return (
    <MobileShell
      navItems={memberNavItems}
      brandTitle="OSAJA'20"
      brandSubtitle="Member Portal"
      footer={
        <div className="rounded-xl bg-brand-50 p-4">
          <p className="truncate text-xs font-medium text-brand-800">{member.fullName}</p>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
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
