"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminDeleteRepoButton({ repositoryId }: { repositoryId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (!confirm("Remove this repository and all of its analysis data?")) return;
    setLoading(true);
    await fetch(`/api/admin/repositories/${repositoryId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-red-600 hover:border-red-300 disabled:opacity-60"
    >
      {loading ? "…" : "Remove"}
    </button>
  );
}
