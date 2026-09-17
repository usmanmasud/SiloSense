import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const repo = await queryOne<{ id: string }>(`SELECT id FROM repositories WHERE id = $1`, [id]);
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await query(`DELETE FROM repositories WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
