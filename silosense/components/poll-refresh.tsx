"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Silently re-fetches the current server component tree on an interval. */
export function PollRefresh({
  active,
  intervalMs = 3000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
