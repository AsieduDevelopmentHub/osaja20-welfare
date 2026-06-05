const stats = [
  { label: "Total Members", value: "48", change: "+3 this month" },
  { label: "Active Members", value: "42", change: "87.5% active" },
  { label: "Pending Welfare", value: "5", change: "2 urgent" },
  { label: "Total Contributions", value: "GH₵ 12,450", change: "+GH₵ 800 this month" },
  { label: "Active Votes", value: "1", change: "Executive election" },
  { label: "Birthdays Today", value: "1", change: "Send celebration" },
];

const modules = [
  { name: "Members", desc: "Search, filter, archive", href: "#" },
  { name: "Welfare", desc: "Case workflow management", href: "#" },
  { name: "Contributions", desc: "Ledger & receipts", href: "#" },
  { name: "Voting", desc: "Elections & decisions", href: "#" },
  { name: "Announcements", desc: "Publish & schedule", href: "#" },
  { name: "Reports", desc: "Export CSV & Excel", href: "#" },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-screen p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-brand-500">Administration</p>
          <h1 className="text-3xl font-bold text-white">OSAJA&apos;20 Welfare</h1>
          <p className="text-slate-400">Leadership analytics & operations center</p>
        </div>
        <div className="flex gap-3">
          <button className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Export Report
          </button>
          <button className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            New Announcement
          </button>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="admin-stat">
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-brand-400">{stat.change}</p>
          </div>
        ))}
      </div>

      <section className="admin-card">
        <h2 className="mb-4 text-lg font-semibold text-white">Management Modules</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <a
              key={mod.name}
              href={mod.href}
              className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-5 transition hover:border-brand-600/40 hover:bg-slate-800/50"
            >
              <h3 className="font-semibold text-white">{mod.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{mod.desc}</p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
