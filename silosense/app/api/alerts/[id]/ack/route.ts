import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await queryOne<{ alert_id: string; user_id: string }>(
    `SELECT a.id as alert_id, r.user_id as user_id
     FROM alerts a
     JOIN components c ON c.id = a.component_id
     JOIN repositories r ON r.id = c.repository_id
     WHERE a.id = $1`,
    [id]
  );

  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await query(`UPDATE alerts SET acknowledged = true WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
