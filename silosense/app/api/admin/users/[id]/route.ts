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
  if (id === admin.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE id = $1`, [id]);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await query(`DELETE FROM users WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
