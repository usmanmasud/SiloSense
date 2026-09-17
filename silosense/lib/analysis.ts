import { db, newId } from "./db";
import { mineRepository, GitMiningError } from "./git-mining";
import { computeComponentFeatures, type ComponentEvent } from "./features";
import {
  computeRiskScore,
  normalizeComplexity,
  ALERT_THRESHOLD,
} from "./scoring";
import { generateRecommendations } from "./recommendations";

const MAX_COMPONENTS = 500;

// Each analysis does a git clone plus a CPU-bound scoring pass on a single
// Node process shared by every user, so concurrent analyses are queued
// rather than all started at once. Runs beyond this limit simply wait as
// 'pending' rows and are picked up as a slot frees.
const MAX_CONCURRENT_ANALYSES = Number(
  process.env.SILOSENSE_MAX_CONCURRENT_ANALYSES ?? 2
);
let runningCount = 0;

/**
 * Pulls the oldest queued run and executes it, as long as there's a free
 * concurrency slot, then repeats until either the queue is empty or all
 * slots are busy. Safe to call redundantly (e.g. once per new run, once at
 * process startup) - node:sqlite's calls are synchronous, so the
 * SELECT-then-mark-running sequence below can't race with itself.
 */
function pumpQueue(): void {
  while (runningCount < MAX_CONCURRENT_ANALYSES) {
    const next = db
      .prepare(
        `SELECT id FROM analysis_runs WHERE status = 'pending' ORDER BY started_at ASC LIMIT 1`
      )
      .get() as { id: string } | undefined;
    if (!next) return;

    runningCount++;
    void runAnalysis(next.id)
      .catch((err) => {
        db.prepare(
          `UPDATE analysis_runs SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?`
        ).run(err instanceof Error ? err.message : "Unknown error", next.id);
      })
      .finally(() => {
        runningCount--;
        pumpQueue();
      });
  }
}

/**
 * Creates a pending analysis run and adds it to the in-process queue. The
 * Next.js server is a long-lived Node process (not a serverless function),
 * so queued jobs run to completion as long as the server stays up; callers
 * poll the run's status via the repository API route.
 */
export function startAnalysisRun(repositoryId: string): string {
  const runId = newId("run");
  db.prepare(
    `INSERT INTO analysis_runs (id, repository_id, status) VALUES (?, ?, 'pending')`
  ).run(runId, repositoryId);

  pumpQueue();
  return runId;
}

declare global {
  var __silosenseQueueResumed: boolean | undefined;
}
if (!globalThis.__silosenseQueueResumed) {
  globalThis.__silosenseQueueResumed = true;
  // Runs that were still 'pending' (never actually started mining) survive
  // a restart safely, so pick them back up once at process startup.
  pumpQueue();
}

export async function runAnalysis(runId: string): Promise<void> {
  const run = db
    .prepare(`SELECT * FROM analysis_runs WHERE id = ?`)
    .get(runId) as { repository_id: string } | undefined;
  if (!run) return;

  const repo = db
    .prepare(`SELECT * FROM repositories WHERE id = ?`)
    .get(run.repository_id) as { id: string; url: string } | undefined;
  if (!repo) return;

  db.prepare(`UPDATE analysis_runs SET status = 'running' WHERE id = ?`).run(
    runId
  );

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

    // --- persist contributors -------------------------------------------
    const contributorIdByEmail = new Map<string, string>();
    const upsertContributor = db.prepare(
      `INSERT INTO contributors (id, repository_id, name, email)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(repository_id, email) DO UPDATE SET name = excluded.name`
    );
    const getContributor = db.prepare(
      `SELECT id FROM contributors WHERE repository_id = ? AND email = ?`
    );
    for (const path of rankedPaths) {
      for (const ev of eventsByPath.get(path)!) {
        if (contributorIdByEmail.has(ev.authorKey)) continue;
        upsertContributor.run(
          newId("contrib"),
          repo.id,
          ev.authorName,
          ev.authorKey
        );
        const row = getContributor.get(repo.id, ev.authorKey) as {
          id: string;
        };
        contributorIdByEmail.set(ev.authorKey, row.id);
      }
    }

    // --- persist components + commit events -------------------------------
    const upsertComponent = db.prepare(
      `INSERT INTO components (id, repository_id, path)
       VALUES (?, ?, ?)
       ON CONFLICT(repository_id, path) DO NOTHING`
    );
    const getComponent = db.prepare(
      `SELECT id FROM components WHERE repository_id = ? AND path = ?`
    );
    const componentIdByPath = new Map<string, string>();
    for (const path of rankedPaths) {
      upsertComponent.run(newId("comp"), repo.id, path);
      const row = getComponent.get(repo.id, path) as { id: string };
      componentIdByPath.set(path, row.id);
    }

    db.prepare(`DELETE FROM commit_events WHERE repository_id = ?`).run(
      repo.id
    );
    const insertEvent = db.prepare(
      `INSERT INTO commit_events
        (id, repository_id, component_id, author_name, author_email, commit_hash, commit_date, additions, deletions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const path of rankedPaths) {
      const componentId = componentIdByPath.get(path)!;
      for (const ev of eventsByPath.get(path)!) {
        insertEvent.run(
          newId("evt"),
          repo.id,
          componentId,
          ev.authorName,
          ev.authorKey,
          "",
          ev.date,
          ev.additions,
          ev.deletions
        );
      }
    }

    // --- compute features + complexity + scores ---------------------------
    const featuresPerPath = rankedPaths.map((path) =>
      computeComponentFeatures(eventsByPath.get(path)!, now)
    );
    const complexityInputs = rankedPaths.map((path, i) => ({
      sizeBytes: mined.fileSizes.get(path) ?? 0,
      churnTotal: featuresPerPath[i].churnTotal,
    }));
    const complexityNorms = normalizeComplexity(complexityInputs);

    const insertFeatures = db.prepare(
      `INSERT INTO component_features (id, component_id, analysis_run_id, observation_date, feature_json)
       VALUES (?, ?, ?, ?, ?)`
    );
    const insertScore = db.prepare(
      `INSERT INTO risk_scores (id, component_id, analysis_run_id, observation_date, score, risk_level, explanation_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertRecommendation = db.prepare(
      `INSERT INTO recommendations (id, component_id, risk_score_id, action, priority)
       VALUES (?, ?, ?, ?, ?)`
    );
    const insertAlert = db.prepare(
      `INSERT INTO alerts (id, component_id, analysis_run_id, previous_score, new_score, threshold)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const previousScoreStmt = db.prepare(
      `SELECT score FROM risk_scores
       WHERE component_id = ? AND analysis_run_id != ?
       ORDER BY observation_date DESC LIMIT 1`
    );

    const observationDate = now.toISOString();

    for (let i = 0; i < rankedPaths.length; i++) {
      const path = rankedPaths[i];
      const componentId = componentIdByPath.get(path)!;
      const features = featuresPerPath[i];
      const complexityNorm = complexityNorms[i];
      const { score, level, explanation } = computeRiskScore(
        features,
        complexityNorm
      );

      insertFeatures.run(
        newId("feat"),
        componentId,
        runId,
        observationDate,
        JSON.stringify({ ...features, sizeBytes: mined.fileSizes.get(path) ?? 0, complexityNorm })
      );

      const scoreId = newId("score");
      insertScore.run(
        scoreId,
        componentId,
        runId,
        observationDate,
        score,
        level,
        JSON.stringify(explanation)
      );

      const recs = generateRecommendations(features, level, complexityNorm);
      for (const rec of recs) {
        insertRecommendation.run(
          newId("rec"),
          componentId,
          scoreId,
          rec.action,
          rec.priority
        );
      }

      const prevRow = previousScoreStmt.get(componentId, runId) as
        | { score: number }
        | undefined;
      const wasAboveThreshold = (prevRow?.score ?? -1) >= ALERT_THRESHOLD;
      const isAboveThreshold = score >= ALERT_THRESHOLD;
      if (isAboveThreshold && !wasAboveThreshold) {
        insertAlert.run(
          newId("alert"),
          componentId,
          runId,
          prevRow?.score ?? null,
          score,
          ALERT_THRESHOLD
        );
      }
    }

    db.prepare(
      `UPDATE analysis_runs
       SET status = 'completed', commit_count = ?, component_count = ?, truncated = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).run(mined.commits.length, rankedPaths.length, mined.truncated ? 1 : 0, runId);
  } catch (err) {
    const message =
      err instanceof GitMiningError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error during analysis.";
    db.prepare(
      `UPDATE analysis_runs SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(message, runId);
  }
}
