import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// SILOSENSE_DATA_DIR should point at a persistent volume in production
// (e.g. Render's disk mount path) - without it, every redeploy on a host
// with an ephemeral filesystem wipes the database.
const dataDir = process.env.SILOSENSE_DATA_DIR
  ? path.resolve(process.env.SILOSENSE_DATA_DIR)
  : path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "silosense.db");

declare global {
  var __silosenseDb: DatabaseSync | undefined;
}

function createConnection() {
  const database = new DatabaseSync(dbPath);
  // Several Next.js build workers can import this module concurrently and
  // race to create the schema on a fresh database; wait instead of failing
  // immediately on a locked file.
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  return database;
}

// Reused across hot reloads in dev so we don't leak file handles.
export const db = globalThis.__silosenseDb ?? createConnection();
if (process.env.NODE_ENV !== "production") globalThis.__silosenseDb = db;

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  default_branch TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  commit_date TEXT NOT NULL,
  additions INTEGER NOT NULL,
  deletions INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  commit_count INTEGER,
  component_count INTEGER,
  truncated INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS component_features (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  observation_date TEXT NOT NULL,
  feature_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_scores (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  observation_date TEXT NOT NULL,
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
  acknowledged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  risk_score_id TEXT NOT NULL REFERENCES risk_scores(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  priority TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  trained_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ml_predictions (
  id TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  ml_model_id TEXT NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
  analysis_run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  probability REAL NOT NULL,
  label INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_components_repo ON components(repository_id);
CREATE INDEX IF NOT EXISTS idx_events_component ON commit_events(component_id);
CREATE INDEX IF NOT EXISTS idx_events_repo ON commit_events(repository_id);
CREATE INDEX IF NOT EXISTS idx_runs_repo ON analysis_runs(repository_id);
CREATE INDEX IF NOT EXISTS idx_features_component ON component_features(component_id);
CREATE INDEX IF NOT EXISTS idx_scores_component ON risk_scores(component_id);
CREATE INDEX IF NOT EXISTS idx_scores_run ON risk_scores(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_alerts_component ON alerts(component_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_component ON recommendations(component_id);
`;

db.exec(schema);

// A run still marked "running" long after it should have finished belongs
// to a previous process that crashed or was redeployed mid-analysis - it
// can never complete itself, so surface it as failed rather than leaving
// it stuck forever. The time bound (comfortably longer than the mining
// timeouts in lib/git-mining.ts) is what makes this safe to run on every
// module load rather than relying on a fragile "only once per process"
// guard - Next.js's dev server can re-evaluate this module more than once
// per process, and a naive unconditional sweep would otherwise be able to
// race with, and clobber, a run that's still genuinely in progress.
db.prepare(
  `UPDATE analysis_runs
   SET status = 'failed',
       error = 'Interrupted by a server restart. Click "Re-analyze" to try again.',
       completed_at = datetime('now')
   WHERE status = 'running' AND started_at < datetime('now', '-15 minutes')`
).run();

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}
