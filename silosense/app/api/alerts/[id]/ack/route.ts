import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = db
    .prepare(
      `SELECT a.id as alert_id, r.user_id as user_id
       FROM alerts a
       JOIN components c ON c.id = a.component_id
       JOIN repositories r ON r.id = c.repository_id
       WHERE a.id = ?`
    )
    .get(id) as { alert_id: string; user_id: string } | undefined;

  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.prepare(`UPDATE alerts SET acknowledged = 1 WHERE id = ?`).run(id);
  return NextResponse.json({ ok: true });
}
