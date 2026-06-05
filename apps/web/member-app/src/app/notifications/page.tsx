import { PageHeader } from "@/components/PageHeader";

export default function NotificationsPage() {
  return (
    <div>
      <PageHeader title="Notifications" description="Meetings, welfare updates, and announcements." />
      <div className="glass-card p-6">
        <p className="text-slate-600">No notifications yet.</p>
      </div>
    </div>
  );
}
