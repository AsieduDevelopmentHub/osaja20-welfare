import { Vote } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function VotingPage() {
  return (
    <div>
      <PageHeader title="Voting" description="Active votes and your voting history." />
      <div className="glass-card flex flex-col items-center gap-2 p-10 text-slate-400">
        <Vote className="h-10 w-10" strokeWidth={1.25} />
        <p className="text-sm">No active votes at the moment</p>
      </div>
    </div>
  );
}
