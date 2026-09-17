import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-foreground">Invalid link</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This reset link is missing its token. Request a new one.
        </p>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/app/forgot-password" className="font-medium text-brand-primary">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This will sign you out everywhere else for security.
      </p>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
