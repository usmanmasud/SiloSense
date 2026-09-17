/**
 * SQLite's datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC with no
 * timezone marker. JS's Date parser treats a space-separated string like
 * that as *local* time, which silently shifts every timestamp by the
 * server's UTC offset. Normalise to a proper ISO string before parsing.
 */
export function parseDbDate(value: string): Date {
  const isoLike = /[T]|Z$|[+-]\d\d:\d\d$/.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  return new Date(isoLike);
}

export function formatRelativeTime(value: string): string {
  const date = parseDbDate(value);
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDate(value: string): string {
  return parseDbDate(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type RiskLevel = "low" | "medium" | "elevated" | "high";

export function riskBadgeClasses(level: string): string {
  switch (level) {
    case "high":
      return "bg-brand-accent text-white";
    case "elevated":
      return "bg-brand-accent/20 text-brand-accent-dark";
    case "medium":
      return "bg-brand-primary/10 text-brand-primary";
    default:
      return "border border-border bg-background text-muted-foreground";
  }
}

export function riskDotClasses(level: string): string {
  switch (level) {
    case "high":
      return "bg-brand-accent";
    case "elevated":
      return "bg-brand-accent/60";
    case "medium":
      return "bg-brand-primary/40";
    default:
      return "bg-border";
  }
}

export function runStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "running":
      return "Analyzing…";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function runStatusClasses(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "failed":
      return "bg-red-50 text-red-700";
    case "running":
      return "bg-brand-accent/15 text-brand-accent-dark";
    default:
      return "bg-muted text-muted-foreground";
  }
}
