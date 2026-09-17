"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddRepositoryForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/repositories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setUrl("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          placeholder="https://github.com/owner/repo"
          className="w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand-primary"
        />
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="shrink-0 rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-dark disabled:opacity-60"
      >
        {loading ? "Starting…" : "Analyze repository"}
      </button>
    </form>
  );
}
