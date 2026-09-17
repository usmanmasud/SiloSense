import { NextRequest, NextResponse } from "next/server";
import { consumePasswordResetToken, setUserPassword } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validation";
import { rateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`reset-confirm:${ip}`, 20, 60 * 60_000).allowed) {
    return tooManyRequestsResponse(600);
  }

  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;
  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  await setUserPassword(userId, password);
  return NextResponse.json({ ok: true });
}
