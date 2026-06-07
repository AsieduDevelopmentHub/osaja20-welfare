"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasRecoveryHash } from "@/lib/recovery";

/** Send Supabase recovery links to /reset-password when they land on the wrong route. */
export function RecoveryRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/reset-password") return;
    if (!hasRecoveryHash()) return;
    router.replace(`/reset-password${window.location.hash}`);
  }, [pathname, router]);

  return null;
}
