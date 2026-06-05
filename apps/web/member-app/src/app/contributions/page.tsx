import { PageHeader } from "@/components/PageHeader";

export default function ContributionsPage() {
  return (
    <div>
      <PageHeader title="Contributions" description="Your contribution history and balance." />
      <div className="glass-card p-6">
        <p className="text-slate-600">Connect to the API to load live contribution data.</p>
      </div>
    </div>
  );
}
