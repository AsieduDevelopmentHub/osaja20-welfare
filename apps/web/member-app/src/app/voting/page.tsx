import { PageHeader } from "@/components/PageHeader";

export default function VotingPage() {
  return (
    <div>
      <PageHeader title="Voting" description="Active votes and your voting history." />
      <div className="glass-card p-6">
        <p className="text-slate-600">No active votes at the moment.</p>
      </div>
    </div>
  );
}
