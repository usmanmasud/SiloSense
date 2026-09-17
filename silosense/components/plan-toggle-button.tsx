"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/plans";

export function PlanToggleButton({ targetPlan, label }: { targetPlan: Plan; label: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch("/api/billing/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: targetPlan }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={
        targetPlan === "pro"
          ? "rounded-full bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-dark disabled:opacity-60"
          : "rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-brand-primary disabled:opacity-60"
      }
    >
      {loading ? "Updating…" : label}
    </button>
  );
}
