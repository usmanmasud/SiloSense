import type { Metadata } from "next";
import { listRecentRuns } from "@/lib/admin-queries";
import { formatRelativeTime, runStatusClasses, runStatusLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Admin · System" };

export default async function AdminSystemPage() {
  const runs = await listRecentRuns(50);

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Most recent 50 analysis runs across every repository, newest first.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Repository</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Commits</th>
              <th className="px-4 py-3 font-medium">Started</th>
              <th className="px-4 py-3 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-mono text-xs text-foreground">
                  {r.owner}/{r.repo_name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.user_email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${runStatusClasses(r.status)}`}>
                    {runStatusLabel(r.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">{r.commit_count ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatRelativeTime(r.started_at)}</td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-red-600">{r.error ?? ""}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No analysis runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
