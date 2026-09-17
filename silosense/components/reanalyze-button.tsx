"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReanalyzeButton({ repositoryId }: { repositoryId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch(`/api/repositories/${repositoryId}/reanalyze`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-60"
    >
      {loading ? "Starting…" : "Re-analyze"}
    </button>
  );
}
