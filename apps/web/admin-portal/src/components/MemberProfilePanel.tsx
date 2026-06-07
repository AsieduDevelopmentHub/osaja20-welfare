"use client";

import { X } from "lucide-react";
import { MemberProfileView } from "@/components/MemberProfileView";

interface MemberProfilePanelProps {
  memberId: string;
  adminId?: string;
  adminRole?: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function MemberProfilePanel({ memberId, adminId, adminRole, onClose, onUpdated }: MemberProfilePanelProps) {
  return (
    <div className="relative rounded-2xl border border-brand-gold/30 bg-brand-navy/80 p-1">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-lg p-1 text-slate-400 hover:bg-white/10"
        aria-label="Close profile"
      >
        <X className="h-5 w-5" />
      </button>
      <MemberProfileView memberId={memberId} adminId={adminId} adminRole={adminRole} onUpdated={onUpdated} />
    </div>
  );
}
