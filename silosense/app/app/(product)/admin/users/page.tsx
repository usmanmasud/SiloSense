import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { listAllUsers } from "@/lib/admin-queries";
import { formatDate } from "@/lib/format";
import { AdminUserActions } from "@/components/admin-user-actions";
import type { Plan } from "@/lib/plans";

export const metadata: Metadata = { title: "Admin · Users" };

export default async function AdminUsersPage() {
  const [me, users] = await Promise.all([getCurrentUser(), listAllUsers()]);

  return (
    <div>
      <p className="text-sm text-muted-foreground">{users.length} total users</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Repos</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 text-foreground">
                  {u.name}
                  {u.is_admin && (
                    <span className="ml-2 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
                      admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-foreground">{u.repo_count}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  {u.suspended ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      Suspended
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <AdminUserActions
                    userId={u.id}
                    plan={u.plan as Plan}
                    suspended={u.suspended}
                    isSelf={u.id === me?.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
