import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { rateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000).allowed) {
    return tooManyRequestsResponse(60);
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;
  if (!rateLimit(`login-email:${email}`, 8, 15 * 60_000).allowed) {
    return tooManyRequestsResponse(60);
  }

  const user = await queryOne<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
    suspended: boolean;
  }>(`SELECT id, email, name, password_hash, suspended FROM users WHERE email = $1`, [email]);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  if (user.suspended) {
    return NextResponse.json(
      { error: "This account has been suspended. Contact support if you think this is a mistake." },
      { status: 403 }
    );
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);

  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
