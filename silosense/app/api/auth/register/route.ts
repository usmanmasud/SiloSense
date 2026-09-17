import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, newId } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { rateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/rate-limit";

const ADMIN_EMAILS = (process.env.SILOSENSE_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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

  const existing = await queryOne(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  const userId = newId("user");
  const isAdmin = ADMIN_EMAILS.includes(email);
  await query(
    `INSERT INTO users (id, email, name, password_hash, is_admin) VALUES ($1, $2, $3, $4, $5)`,
    [userId, email, name, hashPassword(password), isAdmin]
  );

  const token = await createSession(userId);
  await setSessionCookie(token);

  return NextResponse.json({ id: userId, email, name });
}
