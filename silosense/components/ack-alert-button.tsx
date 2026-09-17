"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AckAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    await fetch(`/api/alerts/${alertId}/ack`, { method: "POST" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="shrink-0 text-xs font-medium text-muted-foreground hover:text-brand-primary disabled:opacity-60"
    >
      {loading ? "…" : "Acknowledge"}
    </button>
  );
}
