import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth";
import { requestResetSchema } from "@/lib/validation";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, getClientIp, tooManyRequestsResponse } from "@/lib/rate-limit";

const GENERIC_MESSAGE =
  "If an account exists for that email, we've sent a password reset link.";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`reset:${ip}`, 10, 60 * 60_000).allowed) {
    return tooManyRequestsResponse(600);
  }

  const body = await req.json().catch(() => null);
  const parsed = requestResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { email } = parsed.data;
  if (!rateLimit(`reset-email:${email}`, 4, 60 * 60_000).allowed) {
    // Still return the generic message - don't leak that this email is rate limited.
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);

  if (user) {
    const token = await createPasswordResetToken(user.id);
    const resetUrl = `${req.nextUrl.origin}/app/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl).catch((err) => {
      console.error("Failed to send password reset email:", err);
    });
  }

  // Always the same response, whether or not the email exists, so this
  // endpoint can't be used to enumerate registered accounts.
  return NextResponse.json({ message: GENERIC_MESSAGE });
}
