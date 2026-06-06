"use client";

import { BellRing, Mail, Phone, User } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth";
export default function ProfilePage() {
  const { member } = useAuth();
  const [pushStatus, setPushStatus] = useState<string>("");

  const enablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("Push notifications are not supported in this browser.");
      return;
    }
    setPushStatus("Push will be enabled when VAPID keys are configured on the server.");
    // Ready for Web Push — subscription endpoint: POST /api/v1/push/subscribe
    try {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      setPushStatus("Service worker registered. Add VAPID keys to enable push delivery.");
    } catch {
      setPushStatus("Could not register for push notifications.");
    }
  };

  if (!member) return null;

  const rows = [
    { icon: User, label: "Full name", value: member.fullName },
    { icon: User, label: "Username", value: member.username },
    { icon: Mail, label: "Email", value: member.email },
    { icon: Phone, label: "Phone", value: member.phoneNumber },
    { icon: User, label: "Member ID", value: member.membershipId },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your membership details and settings." />

      <div className="glass-card divide-y divide-slate-100">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-4 px-4 py-4 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
              <Icon className="h-5 w-5 text-brand-600" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="truncate font-medium text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4 sm:p-6">
        <h3 className="font-semibold text-slate-900">Push Notifications</h3>
        <p className="mt-1 text-sm text-slate-500">
          Get alerts for votes, welfare updates, and birthdays — no background workers required.
        </p>
        <button type="button" onClick={enablePush} className="btn-primary mt-4 flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          Enable push
        </button>
        {pushStatus ? <p className="mt-3 text-sm text-slate-600">{pushStatus}</p> : null}
      </div>
    </div>
  );
}
