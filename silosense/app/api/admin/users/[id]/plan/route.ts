import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { isValidPlan } from "@/lib/plans";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const plan = body?.plan;
  if (typeof plan !== "string" || !isValidPlan(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [id]);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await query(`UPDATE users SET plan = $1, plan_updated_at = now() WHERE id = $2`, [plan, id]);
  return NextResponse.json({ ok: true, plan });
}
