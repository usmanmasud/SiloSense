import type { Metadata } from "next";
import { getAdminOverview } from "@/lib/admin-queries";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();

  const stats = [
    { label: "Total users", value: overview.totalUsers },
    { label: "Repositories analyzed", value: overview.totalRepositories },
    { label: "Analysis runs (all time)", value: overview.totalAnalysisRuns },
    { label: "Runs in last 24h", value: overview.runsLast24h },
  ];

  const queue = [
    { label: "Running now", value: overview.runningCount },
    { label: "Queued", value: overview.pendingCount },
    { label: "Failed in last 24h", value: overview.failedLast24h, accent: overview.failedLast24h > 0 },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-background p-4">
            <div className="text-2xl font-semibold text-foreground">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold text-foreground">Queue health</h2>
      <div className="mt-4 grid grid-cols-3 gap-4">
        {queue.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-background p-4">
            <div className={`text-2xl font-semibold ${s.accent ? "text-brand-accent" : "text-foreground"}`}>
              {s.value}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-sm font-semibold text-foreground">Plan distribution</h2>
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
        {overview.planCounts.length === 0 && (
          <p className="text-sm text-muted-foreground">No users yet.</p>
        )}
        {overview.planCounts.map((p) => {
          const pct = overview.totalUsers > 0 ? (p.count / overview.totalUsers) * 100 : 0;
          return (
            <div key={p.plan}>
              <div className="flex items-center justify-between text-xs">
                <span className="capitalize text-foreground">{p.plan}</span>
                <span className="text-muted-foreground">{p.count} users</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-border">
                <div className="h-1.5 rounded-full bg-brand-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <p className="mt-2 border-t border-border pt-3 text-sm text-foreground">
          Estimated MRR: <span className="font-semibold">${overview.mrr}</span>
          <span className="ml-1 text-xs text-muted-foreground">
            (based on manually-set plans, not live billing)
          </span>
        </p>
      </div>
    </div>
  );
}
