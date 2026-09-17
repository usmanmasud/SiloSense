import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listRepositoriesForUser } from "@/lib/queries";
import { AddRepositoryForm } from "@/components/add-repository-form";
import { PollRefresh } from "@/components/poll-refresh";
import { formatRelativeTime, runStatusClasses, runStatusLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Repositories" };

export default async function RepositoriesPage() {
  const user = await getCurrentUser();
  const repositories = listRepositoriesForUser(user!.id);
  const anyInProgress = repositories.some(
    (r) => r.latestRun?.status === "pending" || r.latestRun?.status === "running"
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <PollRefresh active={anyInProgress} />

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Repositories
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a public GitHub repository URL to mine its history and compute
        knowledge-concentration risk for every file.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-background p-5">
        <AddRepositoryForm />
      </div>

      {repositories.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No repositories yet. Add one above to get started.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {repositories.map((repo) => (
            <li key={repo.id}>
              <Link
                href={`/app/repositories/${repo.id}`}
                className="flex flex-col gap-3 rounded-xl border border-border bg-background p-5 transition-colors hover:border-brand-primary sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium text-foreground">
                    {repo.owner}/{repo.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        repo.latestRun ? runStatusClasses(repo.latestRun.status) : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {repo.latestRun ? runStatusLabel(repo.latestRun.status) : "Not analyzed"}
                    </span>
                    {repo.latestRun && (
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(repo.latestRun.started_at)}
                      </span>
                    )}
                  </div>
                </div>

                {repo.latestRun?.status === "completed" && (
                  <div className="flex shrink-0 items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-foreground">
                        {repo.componentCount}
                      </div>
                      <div className="text-xs text-muted-foreground">files</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-brand-accent">
                        {repo.highRiskCount}
                      </div>
                      <div className="text-xs text-muted-foreground">high risk</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-foreground">
                        {repo.averageScore !== null ? Math.round(repo.averageScore) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">avg score</div>
                    </div>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
