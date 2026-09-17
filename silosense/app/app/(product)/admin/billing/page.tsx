import type { Metadata } from "next";
import { getAdminOverview } from "@/lib/admin-queries";
import { PLAN_LIMITS } from "@/lib/plans";

export const metadata: Metadata = { title: "Admin · Billing" };

export default async function AdminBillingPage() {
  const overview = await getAdminOverview();
  const proCount = overview.planCounts.find((p) => p.plan === "pro")?.count ?? 0;
  const freeCount = overview.planCounts.find((p) => p.plan === "free")?.count ?? 0;

  return (
    <div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No live payment processor is connected yet — these numbers reflect
        plans set manually (via account self-upgrade or admin override), not
        real charges. Wire up Stripe and set <code>plan</code> from its
        webhooks to make this real.
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="text-2xl font-semibold text-foreground">${overview.mrr}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Estimated MRR</div>
        </div>
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="text-2xl font-semibold text-foreground">{proCount}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Pro subscribers · ${PLAN_LIMITS.pro.priceMonthlyUsd}/mo each
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="text-2xl font-semibold text-foreground">{freeCount}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Free users</div>
        </div>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-foreground">Plan definitions</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {Object.entries(PLAN_LIMITS).map(([key, limits]) => (
          <div key={key} className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-foreground">{limits.label}</span>
              <span className="text-sm text-muted-foreground">${limits.priceMonthlyUsd}/mo</span>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5 text-xs text-muted-foreground">
              <li>{limits.maxRepositories} repositories</li>
              <li>{limits.maxAnalysesPerHour} analyses / hour</li>
              <li>{limits.mlTrainingEnabled ? "ML training included" : "No ML training"}</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
