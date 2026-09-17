import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PLAN_LIMITS, getPlanLimits } from "@/lib/plans";
import { PlanToggleButton } from "@/components/plan-toggle-button";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  const row = await queryOne<{ created_at: string }>(
    `SELECT created_at FROM users WHERE id = $1`,
    [user!.id]
  );
  const limits = getPlanLimits(user!.plan);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Account</h1>

      <div className="mt-8 rounded-xl border border-border bg-background p-6">
        <dl className="flex flex-col gap-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium text-foreground">{user!.name}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">{user!.email}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="font-medium text-foreground">
              {row ? formatDate(row.created_at) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-foreground">Plan</h2>
      <div className="mt-4 rounded-xl border border-border bg-background p-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-semibold text-foreground">{limits.label}</span>
            {limits.priceMonthlyUsd > 0 && (
              <span className="ml-2 text-sm text-muted-foreground">
                ${limits.priceMonthlyUsd}/mo
              </span>
            )}
          </div>
          {user!.plan === "free" ? (
            <PlanToggleButton targetPlan="pro" label="Upgrade to Pro" />
          ) : (
            <PlanToggleButton targetPlan="free" label="Downgrade to Free" />
          )}
        </div>

        <ul className="mt-5 flex flex-col gap-2 text-sm text-muted-foreground">
          <li>Up to {limits.maxRepositories} repositories</li>
          <li>{limits.maxAnalysesPerHour} analyses per hour</li>
          <li>{limits.mlTrainingEnabled ? "Risk-prediction model training" : "No risk-prediction model training"}</li>
        </ul>

        <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
          This beta doesn&apos;t process real payments yet — the button above
          switches your plan instantly for testing. {PLAN_LIMITS.pro.label} costs
          ${PLAN_LIMITS.pro.priceMonthlyUsd}/mo once billing is live.
        </p>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        SiloSense only stores what it needs to run analyses under your
        account: your login details and the repositories you choose to
        analyze.
      </p>
    </div>
  );
}
