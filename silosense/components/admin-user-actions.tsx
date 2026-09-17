"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/plans";

export function AdminUserActions({
  userId,
  plan,
  suspended,
  isSelf,
}: {
  userId: string;
  plan: Plan;
  suspended: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setPlan(newPlan: string) {
    setLoading(true);
    await fetch(`/api/admin/users/${userId}/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: newPlan }),
    });
    setLoading(false);
    router.refresh();
  }

  async function toggleSuspend() {
    setLoading(true);
    await fetch(`/api/admin/users/${userId}/suspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !suspended }),
    });
    setLoading(false);
    router.refresh();
  }

  async function deleteUser() {
    if (!confirm("Permanently delete this user and everything they analyzed?")) return;
    setLoading(true);
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={plan}
        disabled={loading}
        onChange={(e) => setPlan(e.target.value)}
        className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-60"
      >
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>

      {!isSelf && (
        <>
          <button
            type="button"
            onClick={toggleSuspend}
            disabled={loading}
            className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground hover:border-brand-primary disabled:opacity-60"
          >
            {suspended ? "Unsuspend" : "Suspend"}
          </button>
          <button
            type="button"
            onClick={deleteUser}
            disabled={loading}
            className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-red-600 hover:border-red-300 disabled:opacity-60"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
