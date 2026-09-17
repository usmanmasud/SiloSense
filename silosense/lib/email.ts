const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "SiloSense <onboarding@resend.dev>";

/**
 * Sends via the Resend HTTP API (https://resend.com) - a plain fetch call
 * rather than their SDK, since this is the only email this app sends.
 *
 * Without RESEND_API_KEY configured (e.g. local development), the message
 * is logged to the console instead of sent, so the reset flow is still
 * testable without setting up a provider.
 */
async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) {
    console.log(
      `[email] RESEND_API_KEY not set - would have sent "${subject}" to ${to}:\n${text}`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to send email via Resend (${res.status}): ${body.slice(0, 300)}`);
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendEmail(
    to,
    "Reset your SiloSense password",
    `<p>Someone requested a password reset for this SiloSense account.</p>
     <p><a href="${resetUrl}">Reset your password</a> (expires in 30 minutes).</p>
     <p>If you didn't request this, you can ignore this email.</p>`,
    `Reset your SiloSense password: ${resetUrl} (expires in 30 minutes). If you didn't request this, ignore this email.`
  );
}
