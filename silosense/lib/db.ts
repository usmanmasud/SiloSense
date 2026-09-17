import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Point it at a Postgres connection string " +
      "(a free one from https://neon.tech works well for development) - see README."
  );
}

declare global {
  var __silosensePool: Pool | undefined;
}

// Reused across dev hot reloads so we don't leak connections.
export const pool =
  globalThis.__silosensePool ??
  new Pool({
    connectionString,
    max: Number(process.env.SILOSENSE_DB_POOL_SIZE ?? 10),
    ssl: /localhost|127\.0\.0\.1/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
  });
if (process.env.NODE_ENV !== "production") globalThis.__silosensePool = pool;

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  plan TEXT NOT NULL DEFAULT 'free',
  plan_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  suspended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  default_branch TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, url)
);

CREATE TABLE IF NOT EXISTS contributors (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  UNIQUE(repository_id, email)
);

CREATE TABLE IF NOT EXISTS components (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  UNIQUE(repository_id, path)
);

CREATE TABLE IF NOT EXISTS commit_events (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  commit_date TIMESTAMPTZ NOT NULL,
  additions INTEGER NOT NULL,
  deletions INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  commit_count INTEGER,
  component_count INTEGER,
  truncated BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS component_features (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  observation_date TIMESTAMPTZ NOT NULL,
  feature_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_scores (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  observation_date TIMESTAMPTZ NOT NULL,
  score REAL NOT NULL,
  risk_level TEXT NOT NULL,
  explanation_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  previous_score REAL,
  new_score REAL NOT NULL,
  threshold REAL NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  risk_score_id TEXT NOT NULL REFERENCES risk_scores(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  priority TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_models (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  feature_names_json TEXT NOT NULL,
  weights_json TEXT NOT NULL,
  bias REAL NOT NULL,
  mean_json TEXT NOT NULL,
  std_json TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  n_windows INTEGER NOT NULL,
  trained_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_predictions (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  ml_model_id TEXT NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  probability REAL NOT NULL,
  label INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_components_repo ON components(repository_id);
CREATE INDEX IF NOT EXISTS idx_events_component ON commit_events(component_id);
CREATE INDEX IF NOT EXISTS idx_events_repo ON commit_events(repository_id);
CREATE INDEX IF NOT EXISTS idx_runs_repo ON analysis_runs(repository_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON analysis_runs(status);
CREATE INDEX IF NOT EXISTS idx_features_component ON component_features(component_id);
CREATE INDEX IF NOT EXISTS idx_scores_component ON risk_scores(component_id);
CREATE INDEX IF NOT EXISTS idx_scores_run ON risk_scores(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_alerts_component ON alerts(component_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_component ON recommendations(component_id);
CREATE INDEX IF NOT EXISTS idx_repositories_user ON repositories(user_id);
`;

let ready: Promise<void> | null = null;

/** Runs the (idempotent) schema migration and startup reaping exactly once per process, lazily on first query. */
function ensureReady(): Promise<void> {
  if (!ready) {
    ready = pool.query(schema).then(async () => {
      // A run still marked "running" long after it should have finished
      // belongs to a previous process that crashed or was redeployed
      // mid-analysis - it can never complete itself, so surface it as
      // failed rather than leaving it stuck forever. The time bound makes
      // this safe to run on every startup rather than clobbering a run
      // that's still genuinely in progress.
      await pool.query(
        `UPDATE analysis_runs
         SET status = 'failed',
             error = 'Interrupted by a server restart. Click "Re-analyze" to try again.',
             completed_at = now()
         WHERE status = 'running' AND started_at < now() - interval '15 minutes'`
      );
    });
  }
  return ready;
}

// pg parses TIMESTAMPTZ columns into real JS Date objects, but every date
// field in this codebase is typed and handled as an ISO string (matching
// the original SQLite-backed code, and avoiding re-litigating date-parsing
// correctness in every consumer). Normalising here, once, keeps that
// contract true everywhere without scattering `instanceof Date` checks.
function stringifyDates<T>(row: T): T {
  if (row && typeof row === "object") {
    for (const [key, val] of Object.entries(row as Record<string, unknown>)) {
      if (val instanceof Date) {
        (row as Record<string, unknown>)[key] = val.toISOString();
      }
    }
  }
  return row;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureReady();
  const result = await pool.query(text, params);
  return result.rows.map(stringifyDates) as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Builds the "($1,$2,$3), ($4,$5,$6), ..." fragment and flat values array
 * for a multi-row INSERT, so a batch of rows can be written in one round
 * trip instead of one query per row.
 */
export function bulkValues(rows: unknown[][]): { placeholders: string; values: unknown[] } {
  const values: unknown[] = [];
  const placeholders = rows
    .map((row) => `(${row.map((v) => `$${values.push(v)}`).join(",")})`)
    .join(", ");
  return { placeholders, values };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}
