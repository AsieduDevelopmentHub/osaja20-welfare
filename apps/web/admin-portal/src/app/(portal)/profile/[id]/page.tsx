"use client";

import { use } from "react";
import { MemberProfileView } from "@/components/MemberProfileView";
import { useAuth } from "@/lib/auth";

export default function MemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { member: admin } = useAuth();

  return (
    <MemberProfileView
      memberId={id}
      adminId={admin?.id}
      adminRole={admin?.role}
      showBackLink
    />
  );
}
