"use client";

import { RecoveryRedirect } from "@/components/RecoveryRedirect";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(10,45,110,0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(201,162,39,0.12),transparent)]"
      />
      <div className="relative">
        <RecoveryRedirect />
        {children}
      </div>
    </div>
  );
}
