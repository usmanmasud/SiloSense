import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { isValidPlan } from "@/lib/plans";

/**
 * Monetization scaffolding: this flips a user's plan directly, with no
 * payment involved. It exists so the plan-gated limits elsewhere (repo
 * caps, ML training, analysis rate limits) are real and testable today.
 * Swapping in live billing later means replacing the body of this handler
 * with a Stripe Checkout redirect, and setting the plan from a webhook
 * instead of this request - nothing that reads `users.plan` needs to change.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const plan = body?.plan;
  if (typeof plan !== "string" || !isValidPlan(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  await query(`UPDATE users SET plan = $1, plan_updated_at = now() WHERE id = $2`, [plan, user.id]);
  return NextResponse.json({ plan });
}
