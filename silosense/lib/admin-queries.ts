import { query, queryOne } from "./db";
import { PLAN_LIMITS } from "./plans";

export type AdminOverview = {
  totalUsers: number;
  totalRepositories: number;
  totalAnalysisRuns: number;
  runsLast24h: number;
  runningCount: number;
  pendingCount: number;
  failedLast24h: number;
  planCounts: { plan: string; count: number }[];
  mrr: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const [users, repos, runs, runsLast24h, statusCounts, failedLast24h, planCounts] =
    await Promise.all([
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM users`),
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM repositories`),
      queryOne<{ count: string }>(`SELECT COUNT(*) as count FROM analysis_runs`),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM analysis_runs WHERE started_at > now() - interval '24 hours'`
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM analysis_runs GROUP BY status`
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM analysis_runs
         WHERE status = 'failed' AND started_at > now() - interval '24 hours'`
      ),
      query<{ plan: string; count: string }>(
        `SELECT plan, COUNT(*) as count FROM users GROUP BY plan`
      ),
    ]);

  const statusMap = Object.fromEntries(statusCounts.map((s) => [s.status, Number(s.count)]));
  const planCountsParsed = planCounts.map((p) => ({ plan: p.plan, count: Number(p.count) }));
  const proCount = planCountsParsed.find((p) => p.plan === "pro")?.count ?? 0;

  return {
    totalUsers: Number(users?.count ?? 0),
    totalRepositories: Number(repos?.count ?? 0),
    totalAnalysisRuns: Number(runs?.count ?? 0),
    runsLast24h: Number(runsLast24h?.count ?? 0),
    runningCount: statusMap.running ?? 0,
    pendingCount: statusMap.pending ?? 0,
    failedLast24h: Number(failedLast24h?.count ?? 0),
    planCounts: planCountsParsed,
    mrr: proCount * PLAN_LIMITS.pro.priceMonthlyUsd,
  };
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  plan: string;
  is_admin: boolean;
  suspended: boolean;
  created_at: string;
  repo_count: string;
};

export async function listAllUsers(): Promise<AdminUserRow[]> {
  return query<AdminUserRow>(
    `SELECT u.id, u.email, u.name, u.plan, u.is_admin, u.suspended, u.created_at,
            COUNT(r.id) as repo_count
     FROM users u
     LEFT JOIN repositories r ON r.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );
}

export type AdminRunRow = {
  id: string;
  status: string;
  commit_count: number | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  owner: string;
  repo_name: string;
  user_email: string;
};

export async function listRecentRuns(limit = 30): Promise<AdminRunRow[]> {
  return query<AdminRunRow>(
    `SELECT ar.id, ar.status, ar.commit_count, ar.error, ar.started_at, ar.completed_at,
            r.owner, r.name as repo_name, u.email as user_email
     FROM analysis_runs ar
     JOIN repositories r ON r.id = ar.repository_id
     JOIN users u ON u.id = r.user_id
     ORDER BY ar.started_at DESC
     LIMIT $1`,
    [limit]
  );
}

export type AdminRepositoryRow = {
  id: string;
  owner: string;
  name: string;
  url: string;
  created_at: string;
  user_email: string;
  user_name: string;
};

export async function listAllRepositories(): Promise<AdminRepositoryRow[]> {
  return query<AdminRepositoryRow>(
    `SELECT r.id, r.owner, r.name, r.url, r.created_at, u.email as user_email, u.name as user_name
     FROM repositories r
     JOIN users u ON u.id = r.user_id
     ORDER BY r.created_at DESC`
  );
}
