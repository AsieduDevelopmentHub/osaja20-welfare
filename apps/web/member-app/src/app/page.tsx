import { Sidebar } from "@/components/Sidebar";

const stats = [
  { label: "My Contributions", value: "GH₵ 450.00", icon: "💰", color: "text-accent-green" },
  { label: "Unread Notifications", value: "3", icon: "🔔", color: "text-brand-600" },
  { label: "Active Votes", value: "1", icon: "🗳️", color: "text-purple-600" },
  { label: "Birthdays This Month", value: "2", icon: "🎂", color: "text-accent-gold" },
];

const activities = [
  { text: "New welfare case update on Case #W-042", time: "2 hours ago" },
  { text: "Contribution of GH₵ 50.00 recorded", time: "1 day ago" },
  { text: "Executive election vote is now open", time: "2 days ago" },
  { text: "Birthday celebration for Ama Mensah", time: "3 days ago" },
];

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen gap-6 p-6">
      <Sidebar />

      <main className="flex-1 space-y-6">
        <header>
          <h2 className="text-2xl font-bold text-slate-900">Welcome back, Member</h2>
          <p className="text-slate-500">Here&apos;s what&apos;s happening in your welfare community.</p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{stat.icon}</span>
                <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="glass-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Activity Feed</h3>
            <ul className="space-y-4">
              {activities.map((item, i) => (
                <li key={i} className="flex items-start gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div>
                    <p className="text-sm text-slate-700">{item.text}</p>
                    <p className="text-xs text-slate-400">{item.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Active Vote</h3>
            <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
              <p className="text-sm font-medium opacity-80">Election</p>
              <h4 className="mt-1 text-xl font-bold">Executive Leadership 2026</h4>
              <p className="mt-2 text-sm opacity-90">Cast your vote before the deadline. One member, one vote.</p>
              <button className="mt-4 rounded-xl bg-white px-5 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">
                Vote Now
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
