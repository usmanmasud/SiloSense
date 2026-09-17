import { query, queryOne, newId, bulkValues, chunk } from "./db";
import { mineRepository, GitMiningError } from "./git-mining";
import { computeComponentFeatures, type ComponentEvent } from "./features";
import { computeRiskScore, normalizeComplexity, ALERT_THRESHOLD } from "./scoring";
import { generateRecommendations } from "./recommendations";

const MAX_COMPONENTS = 500;
const INSERT_BATCH_SIZE = 300;

// Each analysis does a git clone plus a CPU-bound scoring pass on a single
// Node process shared by every user, so concurrent analyses are queued
// rather than all started at once. Runs beyond this limit simply wait as
// 'pending' rows and are picked up as a slot frees. This counter is a soft,
// in-process cap on how much work this instance launches at once; the
// SELECT ... FOR UPDATE SKIP LOCKED claim below is what actually guarantees
// a run is never picked up twice, so the two together stay correct even if
// this process ever runs alongside another one.
const MAX_CONCURRENT_ANALYSES = Number(
  process.env.SILOSENSE_MAX_CONCURRENT_ANALYSES ?? 2
);
let runningCount = 0;

/**
 * Atomically claims the oldest queued run (if any) and flips it to
 * 'running' in the same statement, then repeats until either the queue is
 * empty or the concurrency cap is reached. FOR UPDATE SKIP LOCKED is the
 * standard Postgres pattern for a safe multi-worker job queue - it's what
 * makes this correct even if pumpQueue() is ever invoked concurrently
 * (e.g. from more than one process), not just within this one.
 */
async function pumpQueue(): Promise<void> {
  while (runningCount < MAX_CONCURRENT_ANALYSES) {
    const claimed = await queryOne<{ id: string }>(
      `UPDATE analysis_runs SET status = 'running'
       WHERE id = (
         SELECT id FROM analysis_runs
         WHERE status = 'pending'
         ORDER BY started_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING id`
    );
    if (!claimed) return;

    runningCount++;
    void runAnalysis(claimed.id)
      .catch(async (err) => {
        await query(
          `UPDATE analysis_runs SET status = 'failed', error = $1, completed_at = now() WHERE id = $2`,
          [err instanceof Error ? err.message : "Unknown error", claimed.id]
        );
      })
      .finally(() => {
        runningCount--;
        void pumpQueue();
      });
  }
}

/**
 * Creates a pending analysis run and adds it to the queue. The Next.js
 * server is a long-lived Node process (not a serverless function), so
 * queued jobs run to completion as long as the server stays up; callers
 * poll the run's status via the repository API route.
 */
export async function startAnalysisRun(repositoryId: string): Promise<string> {
  const runId = newId("run");
  await query(
    `INSERT INTO analysis_runs (id, repository_id, status) VALUES ($1, $2, 'pending')`,
    [runId, repositoryId]
  );

  void pumpQueue();
  return runId;
}

declare global {
  var __silosenseQueueResumed: boolean | undefined;
}
// `next build` imports every route module to collect its metadata, which
// would otherwise trigger a real (and pointless) database connection
// attempt here on each of the build's worker processes. NEXT_PHASE is set
// by Next.js only during that build step, never at actual runtime.
if (
  !globalThis.__silosenseQueueResumed &&
  process.env.NEXT_PHASE !== "phase-production-build"
) {
  globalThis.__silosenseQueueResumed = true;
  // Runs that were still 'pending' (never actually started mining) survive
  // a restart safely, so pick them back up once at process startup.
  pumpQueue().catch((err) => {
    console.error("Failed to resume the analysis queue on startup:", err);
  });
}

export async function runAnalysis(runId: string): Promise<void> {
  const run = await queryOne<{ repository_id: string }>(
    `SELECT * FROM analysis_runs WHERE id = $1`,
    [runId]
  );
  if (!run) return;

  const repo = await queryOne<{ id: string; url: string }>(
    `SELECT * FROM repositories WHERE id = $1`,
    [run.repository_id]
  );
  if (!repo) return;

  try {
    const mined = await mineRepository(repo.url);
    const now = new Date();

    // path -> ComponentEvent[], restricted to files that still exist at HEAD
    const eventsByPath = new Map<string, ComponentEvent[]>();
    for (const commit of mined.commits) {
      const authorKey = commit.authorEmail.toLowerCase();
      for (const file of commit.files) {
        if (!mined.fileSizes.has(file.path)) continue;
        const list = eventsByPath.get(file.path) ?? [];
        list.push({
          date: commit.date,
          authorKey,
          authorName: commit.authorName,
          additions: file.additions,
          deletions: file.deletions,
        });
        eventsByPath.set(file.path, list);
      }
    }

    const rankedPaths = Array.from(eventsByPath.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, MAX_COMPONENTS)
      .map(([path]) => path);

    // --- contributors -------------------------------------------------
    const contributorsByEmail = new Map<string, { name: string; email: string }>();
    for (const path of rankedPaths) {
      for (const ev of eventsByPath.get(path)!) {
        if (!contributorsByEmail.has(ev.authorKey)) {
          contributorsByEmail.set(ev.authorKey, { name: ev.authorName, email: ev.authorKey });
        }
      }
    }
    for (const batch of chunk(Array.from(contributorsByEmail.values()), INSERT_BATCH_SIZE)) {
      const { placeholders, values } = bulkValues(
        batch.map((c) => [newId("contrib"), repo.id, c.name, c.email])
      );
      await query(
        `INSERT INTO contributors (id, repository_id, name, email) VALUES ${placeholders}
         ON CONFLICT (repository_id, email) DO UPDATE SET name = excluded.name`,
        values
      );
    }

    // --- components -----------------------------------------------------
    for (const batch of chunk(rankedPaths, INSERT_BATCH_SIZE)) {
      const { placeholders, values } = bulkValues(
        batch.map((path) => [newId("comp"), repo.id, path])
      );
      await query(
        `INSERT INTO components (id, repository_id, path) VALUES ${placeholders}
         ON CONFLICT (repository_id, path) DO NOTHING`,
        values
      );
    }
    const componentRows = await query<{ id: string; path: string }>(
      `SELECT id, path FROM components WHERE repository_id = $1`,
      [repo.id]
    );
    const componentIdByPath = new Map(componentRows.map((c) => [c.path, c.id]));

    // --- commit events (replace this repo's stored history each run) ----
    await query(`DELETE FROM commit_events WHERE repository_id = $1`, [repo.id]);
    const eventRows: unknown[][] = [];
    for (const path of rankedPaths) {
      const componentId = componentIdByPath.get(path)!;
      for (const ev of eventsByPath.get(path)!) {
        eventRows.push([
          newId("evt"),
          repo.id,
          componentId,
          ev.authorName,
          ev.authorKey,
          "",
          ev.date,
          ev.additions,
          ev.deletions,
        ]);
      }
    }
    for (const batch of chunk(eventRows, INSERT_BATCH_SIZE)) {
      const { placeholders, values } = bulkValues(batch);
      await query(
        `INSERT INTO commit_events
          (id, repository_id, component_id, author_name, author_email, commit_hash, commit_date, additions, deletions)
         VALUES ${placeholders}`,
        values
      );
    }

    // --- features + complexity + scores ---------------------------------
    const featuresPerPath = rankedPaths.map((path) =>
      computeComponentFeatures(eventsByPath.get(path)!, now)
    );
    const complexityInputs = rankedPaths.map((path, i) => ({
      sizeBytes: mined.fileSizes.get(path) ?? 0,
      churnTotal: featuresPerPath[i].churnTotal,
    }));
    const complexityNorms = normalizeComplexity(complexityInputs);

    const previousScores = await query<{ component_id: string; score: number }>(
      `SELECT DISTINCT ON (component_id) component_id, score
       FROM risk_scores
       WHERE component_id = ANY($1) AND analysis_run_id != $2
       ORDER BY component_id, observation_date DESC`,
      [Array.from(componentIdByPath.values()), runId]
    );
    const previousScoreByComponent = new Map(
      previousScores.map((r) => [r.component_id, r.score])
    );

    const observationDate = now.toISOString();
    const featureRows: unknown[][] = [];
    const scoreRows: unknown[][] = [];
    const recommendationRows: unknown[][] = [];
    const alertRows: unknown[][] = [];

    for (let i = 0; i < rankedPaths.length; i++) {
      const path = rankedPaths[i];
      const componentId = componentIdByPath.get(path)!;
      const features = featuresPerPath[i];
      const complexityNorm = complexityNorms[i];
      const { score, level, explanation } = computeRiskScore(features, complexityNorm);

      featureRows.push([
        newId("feat"),
        componentId,
        runId,
        observationDate,
        JSON.stringify({
          ...features,
          sizeBytes: mined.fileSizes.get(path) ?? 0,
          complexityNorm,
        }),
      ]);

      const scoreId = newId("score");
      scoreRows.push([
        scoreId,
        componentId,
        runId,
        observationDate,
        score,
        level,
        JSON.stringify(explanation),
      ]);

      for (const rec of generateRecommendations(features, level, complexityNorm)) {
        recommendationRows.push([newId("rec"), componentId, scoreId, rec.action, rec.priority]);
      }

      const previousScore = previousScoreByComponent.get(componentId) ?? null;
      const wasAboveThreshold = (previousScore ?? -1) >= ALERT_THRESHOLD;
      const isAboveThreshold = score >= ALERT_THRESHOLD;
      if (isAboveThreshold && !wasAboveThreshold) {
        alertRows.push([newId("alert"), componentId, runId, previousScore, score, ALERT_THRESHOLD]);
      }
    }

    for (const batch of chunk(featureRows, INSERT_BATCH_SIZE)) {
      const { placeholders, values } = bulkValues(batch);
      await query(
        `INSERT INTO component_features (id, component_id, analysis_run_id, observation_date, feature_json)
         VALUES ${placeholders}`,
        values
      );
    }
    for (const batch of chunk(scoreRows, INSERT_BATCH_SIZE)) {
      const { placeholders, values } = bulkValues(batch);
      await query(
        `INSERT INTO risk_scores (id, component_id, analysis_run_id, observation_date, score, risk_level, explanation_json)
         VALUES ${placeholders}`,
        values
      );
    }
    for (const batch of chunk(recommendationRows, INSERT_BATCH_SIZE)) {
      const { placeholders, values } = bulkValues(batch);
      await query(
        `INSERT INTO recommendations (id, component_id, risk_score_id, action, priority) VALUES ${placeholders}`,
        values
      );
    }
    for (const batch of chunk(alertRows, INSERT_BATCH_SIZE)) {
      const { placeholders, values } = bulkValues(batch);
      await query(
        `INSERT INTO alerts (id, component_id, analysis_run_id, previous_score, new_score, threshold)
         VALUES ${placeholders}`,
        values
      );
    }

    await query(
      `UPDATE analysis_runs
       SET status = 'completed', commit_count = $1, component_count = $2, truncated = $3, completed_at = now()
       WHERE id = $4`,
      [mined.commits.length, rankedPaths.length, mined.truncated, runId]
    );
  } catch (err) {
    const message =
      err instanceof GitMiningError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error during analysis.";
    await query(
      `UPDATE analysis_runs SET status = 'failed', error = $1, completed_at = now() WHERE id = $2`,
      [message, runId]
    );
  }
}
