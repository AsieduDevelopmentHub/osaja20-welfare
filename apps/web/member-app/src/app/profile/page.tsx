import { PageHeader } from "@/components/PageHeader";

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="Profile" description="Your membership details and settings." />
      <div className="glass-card p-6">
        <p className="text-slate-600">Sign in to view and update your profile.</p>
      </div>
    </div>
  );
}
