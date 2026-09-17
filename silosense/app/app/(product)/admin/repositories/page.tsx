import type { Metadata } from "next";
import { listAllRepositories } from "@/lib/admin-queries";
import { formatRelativeTime } from "@/lib/format";
import { AdminDeleteRepoButton } from "@/components/admin-delete-repo-button";

export const metadata: Metadata = { title: "Admin · Repositories" };

export default async function AdminRepositoriesPage() {
  const repositories = await listAllRepositories();

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Every repository analyzed by any user. Removing one deletes its
        analysis history for that user.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Repository</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Analyzed</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {repositories.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-mono text-xs text-foreground">
                  <a
                    href={r.url.replace(/\.git$/, "")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand-primary"
                  >
                    {r.owner}/{r.name}
                  </a>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.user_name} · {r.user_email}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatRelativeTime(r.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <AdminDeleteRepoButton repositoryId={r.id} />
                </td>
              </tr>
            ))}
            {repositories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No repositories analyzed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
