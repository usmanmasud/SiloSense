import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "silosense.db");

declare global {
  // eslint-disable-next-line no-var
  var __silosenseDb: DatabaseSync | undefined;
}

function createConnection() {
  const database = new DatabaseSync(dbPath);
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

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}
