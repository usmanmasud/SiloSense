import { NextRequest, NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { rateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`register:${ip}`, 8, 60 * 60_000).allowed) {
    return tooManyRequestsResponse(300);
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;

  const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  const userId = newId("user");
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`
  ).run(userId, email, name, hashPassword(password));

  const token = createSession(userId);
  await setSessionCookie(token);

  return NextResponse.json({ id: userId, email, name });
}
