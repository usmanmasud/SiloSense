import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json({ error: "You can't suspend your own account." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const suspended = Boolean(body?.suspended);

  const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [id]);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await query(`UPDATE users SET suspended = $1 WHERE id = $2`, [suspended, id]);
  if (suspended) {
    await query(`DELETE FROM sessions WHERE user_id = $1`, [id]);
  }

  return NextResponse.json({ ok: true, suspended });
}
