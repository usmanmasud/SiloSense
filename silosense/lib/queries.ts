import { db } from "./db";

export type RepositoryRow = {
  id: string;
  user_id: string;
  owner: string;
  name: string;
  url: string;
  default_branch: string | null;
  created_at: string;
};

export type AnalysisRunRow = {
  id: string;
  repository_id: string;
  status: "pending" | "running" | "completed" | "failed";
  commit_count: number | null;
  component_count: number | null;
  truncated: number;
  error: string | null;
  started_at: string;
  completed_at: string | null;
};

export function getRepositoryForUser(
  userId: string,
  repositoryId: string
): RepositoryRow | null {
  const row = db
    .prepare(`SELECT * FROM repositories WHERE id = ? AND user_id = ?`)
    .get(repositoryId, userId) as RepositoryRow | undefined;
  return row ?? null;
}

export function getLatestRun(repositoryId: string): AnalysisRunRow | null {
  const row = db
    .prepare(
      `SELECT * FROM analysis_runs WHERE repository_id = ? ORDER BY started_at DESC LIMIT 1`
    )
    .get(repositoryId) as AnalysisRunRow | undefined;
  return row ?? null;
}

export function listRunsForRepository(repositoryId: string): AnalysisRunRow[] {
  return db
    .prepare(
      `SELECT * FROM analysis_runs WHERE repository_id = ? ORDER BY started_at DESC`
    )
    .all(repositoryId) as AnalysisRunRow[];
}

export type RepositorySummary = RepositoryRow & {
  latestRun: AnalysisRunRow | null;
  componentCount: number;
  highRiskCount: number;
  averageScore: number | null;
};

export function listRepositoriesForUser(userId: string): RepositorySummary[] {
  const repos = db
    .prepare(`SELECT * FROM repositories WHERE user_id = ? ORDER BY created_at DESC`)
    .all(userId) as RepositoryRow[];

  return repos.map((repo) => {
    const latestRun = getLatestRun(repo.id);
    const stats = db
      .prepare(
        `WITH latest AS (
           SELECT rs.*, ROW_NUMBER() OVER (
             PARTITION BY rs.component_id ORDER BY rs.observation_date DESC
           ) AS rn
           FROM risk_scores rs
           JOIN components c ON c.id = rs.component_id
           WHERE c.repository_id = ?
         )
         SELECT
           COUNT(*) AS componentCount,
           SUM(CASE WHEN score >= 80 THEN 1 ELSE 0 END) AS highRiskCount,
           AVG(score) AS averageScore
         FROM latest WHERE rn = 1`
      )
      .get(repo.id) as {
      componentCount: number;
      highRiskCount: number | null;
      averageScore: number | null;
    };

    return {
      ...repo,
      latestRun,
      componentCount: stats.componentCount ?? 0,
      highRiskCount: stats.highRiskCount ?? 0,
      averageScore: stats.averageScore,
    };
  });
}

export type LatestComponentScore = {
  component_id: string;
  component_path: string;
  score: number;
  risk_level: string;
  observation_date: string;
  explanation_json: string;
  analysis_run_id: string;
  risk_score_id: string;
};

export function getLatestScoresForRepository(
  repositoryId: string
): LatestComponentScore[] {
  return db
    .prepare(
      `WITH latest AS (
         SELECT rs.*, ROW_NUMBER() OVER (
           PARTITION BY rs.component_id ORDER BY rs.observation_date DESC
         ) AS rn
         FROM risk_scores rs
         JOIN components c ON c.id = rs.component_id
         WHERE c.repository_id = ?
       )
       SELECT l.id as risk_score_id, l.component_id, c.path as component_path,
              l.score, l.risk_level, l.observation_date, l.explanation_json, l.analysis_run_id
       FROM latest l
       JOIN components c ON c.id = l.component_id
       WHERE l.rn = 1
       ORDER BY l.score DESC`
    )
    .all(repositoryId) as LatestComponentScore[];
}

export function getRecommendationsForScore(riskScoreId: string) {
  return db
    .prepare(
      `SELECT * FROM recommendations WHERE risk_score_id = ? ORDER BY
       CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`
    )
    .all(riskScoreId) as {
    id: string;
    action: string;
    priority: string;
    created_at: string;
  }[];
}

export function getComponentById(componentId: string) {
  return db.prepare(`SELECT * FROM components WHERE id = ?`).get(componentId) as
    | { id: string; repository_id: string; path: string }
    | undefined;
}

export function getScoreHistoryForComponent(componentId: string) {
  return db
    .prepare(
      `SELECT id, score, risk_level, observation_date, explanation_json, analysis_run_id
       FROM risk_scores WHERE component_id = ? ORDER BY observation_date ASC`
    )
    .all(componentId) as {
    id: string;
    score: number;
    risk_level: string;
    observation_date: string;
    explanation_json: string;
    analysis_run_id: string;
  }[];
}

export function getAlertsForRepository(repositoryId: string, limit = 50) {
  return db
    .prepare(
      `SELECT a.*, c.path as component_path
       FROM alerts a
       JOIN components c ON c.id = a.component_id
       WHERE c.repository_id = ?
       ORDER BY a.created_at DESC
       LIMIT ?`
    )
    .all(repositoryId, limit) as {
    id: string;
    component_id: string;
    component_path: string;
    previous_score: number | null;
    new_score: number;
    threshold: number;
    acknowledged: number;
    created_at: string;
  }[];
}

export function getAlertsForUser(userId: string, limit = 100) {
  return db
    .prepare(
      `SELECT a.*, c.path as component_path, c.id as component_id,
              r.id as repository_id, r.owner as repository_owner, r.name as repository_name
       FROM alerts a
       JOIN components c ON c.id = a.component_id
       JOIN repositories r ON r.id = c.repository_id
       WHERE r.user_id = ?
       ORDER BY a.created_at DESC
       LIMIT ?`
    )
    .all(userId, limit) as {
    id: string;
    component_id: string;
    component_path: string;
    repository_id: string;
    repository_owner: string;
    repository_name: string;
    previous_score: number | null;
    new_score: number;
    threshold: number;
    acknowledged: number;
    created_at: string;
  }[];
}

export type MlModelRow = {
  id: string;
  repository_id: string;
  feature_names_json: string;
  weights_json: string;
  bias: number;
  mean_json: string;
  std_json: string;
  metrics_json: string;
  n_windows: number;
  trained_at: string;
};

export function getLatestMlModel(repositoryId: string): MlModelRow | null {
  const row = db
    .prepare(
      `SELECT * FROM ml_models WHERE repository_id = ? ORDER BY trained_at DESC LIMIT 1`
    )
    .get(repositoryId) as MlModelRow | undefined;
  return row ?? null;
}

export function getMlPredictionForComponent(
  componentId: string,
  mlModelId: string
) {
  const row = db
    .prepare(
      `SELECT * FROM ml_predictions
       WHERE component_id = ? AND ml_model_id = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(componentId, mlModelId) as
    | { probability: number; label: number; created_at: string }
    | undefined;
  return row ?? null;
}

export function getContributorsForRepository(repositoryId: string) {
  return db
    .prepare(
      `SELECT id, name, email FROM contributors WHERE repository_id = ? ORDER BY name`
    )
    .all(repositoryId) as { id: string; name: string; email: string }[];
}
