export type Plan = "free" | "pro";

export type PlanLimits = {
  label: string;
  priceMonthlyUsd: number;
  maxRepositories: number;
  maxAnalysesPerHour: number;
  mlTrainingEnabled: boolean;
};

/**
 * Monetization scaffolding: real plan gates, no live payment processing yet.
 * Upgrading currently happens via /api/billing/upgrade, which sets `plan`
 * directly (self-serve "start a free trial of Pro" today; swap for a real
 * Stripe checkout + webhook handler without touching anything that reads
 * PLAN_LIMITS, since everything downstream only cares about the plan value).
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    label: "Free",
    priceMonthlyUsd: 0,
    maxRepositories: 3,
    maxAnalysesPerHour: 5,
    mlTrainingEnabled: false,
  },
  pro: {
    label: "Pro",
    priceMonthlyUsd: 19,
    maxRepositories: 25,
    maxAnalysesPerHour: 30,
    mlTrainingEnabled: true,
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free;
}

export function isValidPlan(value: string): value is Plan {
  return value === "free" || value === "pro";
}
