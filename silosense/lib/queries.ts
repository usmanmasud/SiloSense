import { query, queryOne } from "./db";

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
  truncated: boolean;
  error: string | null;
  started_at: string;
  completed_at: string | null;
};

export async function getRepositoryForUser(
  userId: string,
  repositoryId: string
): Promise<RepositoryRow | null> {
  return queryOne<RepositoryRow>(
    `SELECT * FROM repositories WHERE id = $1 AND user_id = $2`,
    [repositoryId, userId]
  );
}

export async function getLatestRun(repositoryId: string): Promise<AnalysisRunRow | null> {
  return queryOne<AnalysisRunRow>(
    `SELECT * FROM analysis_runs WHERE repository_id = $1 ORDER BY started_at DESC LIMIT 1`,
    [repositoryId]
  );
}

export async function listRunsForRepository(repositoryId: string): Promise<AnalysisRunRow[]> {
  return query<AnalysisRunRow>(
    `SELECT * FROM analysis_runs WHERE repository_id = $1 ORDER BY started_at DESC`,
    [repositoryId]
  );
}

export type RepositorySummary = RepositoryRow & {
  latestRun: AnalysisRunRow | null;
  componentCount: number;
  highRiskCount: number;
  averageScore: number | null;
};

export async function listRepositoriesForUser(userId: string): Promise<RepositorySummary[]> {
  const repos = await query<RepositoryRow>(
    `SELECT * FROM repositories WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return Promise.all(
    repos.map(async (repo) => {
      const [latestRun, stats] = await Promise.all([
        getLatestRun(repo.id),
        queryOne<{
          componentcount: string;
          highriskcount: string | null;
          averagescore: number | null;
        }>(
          `WITH latest AS (
             SELECT rs.*, ROW_NUMBER() OVER (
               PARTITION BY rs.component_id ORDER BY rs.observation_date DESC
             ) AS rn
             FROM risk_scores rs
             JOIN components c ON c.id = rs.component_id
             WHERE c.repository_id = $1
           )
           SELECT
             COUNT(*) AS componentCount,
             SUM(CASE WHEN score >= 80 THEN 1 ELSE 0 END) AS highRiskCount,
             AVG(score) AS averageScore
           FROM latest WHERE rn = 1`,
          [repo.id]
        ),
      ]);

      return {
        ...repo,
        latestRun,
        componentCount: Number(stats?.componentcount ?? 0),
        highRiskCount: Number(stats?.highriskcount ?? 0),
        averageScore: stats?.averagescore ?? null,
      };
    })
  );
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

export async function getLatestScoresForRepository(
  repositoryId: string
): Promise<LatestComponentScore[]> {
  return query<LatestComponentScore>(
    `WITH latest AS (
       SELECT rs.*, ROW_NUMBER() OVER (
         PARTITION BY rs.component_id ORDER BY rs.observation_date DESC
       ) AS rn
       FROM risk_scores rs
       JOIN components c ON c.id = rs.component_id
       WHERE c.repository_id = $1
     )
     SELECT l.id as risk_score_id, l.component_id, c.path as component_path,
            l.score, l.risk_level, l.observation_date, l.explanation_json, l.analysis_run_id
     FROM latest l
     JOIN components c ON c.id = l.component_id
     WHERE l.rn = 1
     ORDER BY l.score DESC`,
    [repositoryId]
  );
}

export async function getRecommendationsForScore(riskScoreId: string) {
  return query<{
    id: string;
    action: string;
    priority: string;
    created_at: string;
  }>(
    `SELECT * FROM recommendations WHERE risk_score_id = $1 ORDER BY
     CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`,
    [riskScoreId]
  );
}

export async function getComponentById(componentId: string) {
  return queryOne<{ id: string; repository_id: string; path: string }>(
    `SELECT * FROM components WHERE id = $1`,
    [componentId]
  );
}

export async function getScoreHistoryForComponent(componentId: string) {
  return query<{
    id: string;
    score: number;
    risk_level: string;
    observation_date: string;
    explanation_json: string;
    analysis_run_id: string;
  }>(
    `SELECT id, score, risk_level, observation_date, explanation_json, analysis_run_id
     FROM risk_scores WHERE component_id = $1 ORDER BY observation_date ASC`,
    [componentId]
  );
}

export async function getAlertsForRepository(repositoryId: string, limit = 50) {
  return query<{
    id: string;
    component_id: string;
    component_path: string;
    previous_score: number | null;
    new_score: number;
    threshold: number;
    acknowledged: boolean;
    created_at: string;
  }>(
    `SELECT a.*, c.path as component_path
     FROM alerts a
     JOIN components c ON c.id = a.component_id
     WHERE c.repository_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [repositoryId, limit]
  );
}

export async function getAlertsForUser(userId: string, limit = 100) {
  return query<{
    id: string;
    component_id: string;
    component_path: string;
    repository_id: string;
    repository_owner: string;
    repository_name: string;
    previous_score: number | null;
    new_score: number;
    threshold: number;
    acknowledged: boolean;
    created_at: string;
  }>(
    `SELECT a.*, c.path as component_path, c.id as component_id,
            r.id as repository_id, r.owner as repository_owner, r.name as repository_name
     FROM alerts a
     JOIN components c ON c.id = a.component_id
     JOIN repositories r ON r.id = c.repository_id
     WHERE r.user_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
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

export async function getLatestMlModel(repositoryId: string): Promise<MlModelRow | null> {
  return queryOne<MlModelRow>(
    `SELECT * FROM ml_models WHERE repository_id = $1 ORDER BY trained_at DESC LIMIT 1`,
    [repositoryId]
  );
}

export async function getMlPredictionForComponent(componentId: string, mlModelId: string) {
  return queryOne<{ probability: number; label: number; created_at: string }>(
    `SELECT * FROM ml_predictions
     WHERE component_id = $1 AND ml_model_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [componentId, mlModelId]
  );
}

export async function getContributorsForRepository(repositoryId: string) {
  return query<{ id: string; name: string; email: string }>(
    `SELECT id, name, email FROM contributors WHERE repository_id = $1 ORDER BY name`,
    [repositoryId]
  );
}
