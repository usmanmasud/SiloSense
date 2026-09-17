import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  const row = db
    .prepare(`SELECT created_at FROM users WHERE id = ?`)
    .get(user!.id) as { created_at: string };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Account</h1>

      <div className="mt-8 rounded-xl border border-border bg-background p-6">
        <dl className="flex flex-col gap-4 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium text-foreground">{user!.name}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">{user!.email}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="font-medium text-foreground">
              {new Date(row.created_at.replace(" ", "T") + "Z").toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        SiloSense only stores what it needs to run analyses under your
        account: your login details and the repositories you choose to
        analyze.
      </p>
    </div>
  );
}
