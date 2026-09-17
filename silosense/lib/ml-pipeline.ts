import { db, newId } from "./db";
import { trainRiskModel, predictWithModel } from "./ml/train";
import { toVector } from "./ml/windows";
import { computeComponentFeatures, type ComponentEvent } from "./features";
import { minMaxNormalize } from "./scoring";
import type { ComponentHistory } from "./ml/windows";

export type TrainOutcome =
  | { ok: true; modelId: string }
  | { ok: false; reason: string };

/**
 * Trains a repository-scoped risk-prediction model from the commit history
 * already stored by the last analysis run, then immediately scores every
 * current component with it so the dashboard has something to show.
 */
export async function trainAndPersistModel(
  repositoryId: string
): Promise<TrainOutcome> {
  const components = db
    .prepare(`SELECT id, path FROM components WHERE repository_id = ?`)
    .all(repositoryId) as { id: string; path: string }[];

  if (components.length === 0) {
    return {
      ok: false,
      reason: "No analyzed components found yet — run an analysis first.",
    };
  }

  const eventRows = db
    .prepare(
      `SELECT component_id, author_email, author_name, commit_date, additions, deletions
       FROM commit_events WHERE repository_id = ? ORDER BY commit_date ASC`
    )
    .all(repositoryId) as {
    component_id: string;
    author_email: string;
    author_name: string;
    commit_date: string;
    additions: number;
    deletions: number;
  }[];

  if (eventRows.length === 0) {
    return {
      ok: false,
      reason: "No commit history stored yet — run an analysis first.",
    };
  }

  const eventsByComponent = new Map<string, ComponentEvent[]>();
  let minDate = eventRows[0].commit_date;
  let maxDate = eventRows[0].commit_date;
  for (const row of eventRows) {
    if (row.commit_date < minDate) minDate = row.commit_date;
    if (row.commit_date > maxDate) maxDate = row.commit_date;
    const list = eventsByComponent.get(row.component_id) ?? [];
    list.push({
      date: row.commit_date,
      authorKey: row.author_email,
      authorName: row.author_name,
      additions: row.additions,
      deletions: row.deletions,
    });
    eventsByComponent.set(row.component_id, list);
  }

  const histories: ComponentHistory[] = components
    .filter((c) => eventsByComponent.has(c.id))
    .map((c) => ({ componentId: c.id, events: eventsByComponent.get(c.id)! }));

  const result = trainRiskModel(histories, new Date(minDate), new Date(maxDate));
  if (!result.ok) return { ok: false, reason: result.reason };

  const modelId = newId("model");
  db.prepare(
    `INSERT INTO ml_models
      (id, repository_id, feature_names_json, weights_json, bias, mean_json, std_json, metrics_json, n_windows)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    modelId,
    repositoryId,
    JSON.stringify(result.featureNames),
    JSON.stringify(result.weights),
    result.bias,
    JSON.stringify(result.mean),
    JSON.stringify(result.std),
    JSON.stringify(result.metrics),
    result.nWindows
  );

  const latestRun = db
    .prepare(
      `SELECT id FROM analysis_runs WHERE repository_id = ? AND status = 'completed'
       ORDER BY started_at DESC LIMIT 1`
    )
    .get(repositoryId) as { id: string } | undefined;

  if (latestRun) {
    const now = new Date();
    const currentFeatures = histories.map((h) =>
      computeComponentFeatures(h.events, now)
    );
    const churnNorm = minMaxNormalize(
      currentFeatures.map((f) => Math.log(1 + f.churnTotal))
    );

    const insertPred = db.prepare(
      `INSERT INTO ml_predictions (id, component_id, ml_model_id, analysis_run_id, probability, label)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    histories.forEach((h, i) => {
      const vector = toVector(currentFeatures[i], churnNorm[i]);
      const probability = predictWithModel(vector, result);
      insertPred.run(
        newId("pred"),
        h.componentId,
        modelId,
        latestRun.id,
        probability,
        probability >= 0.5 ? 1 : 0
      );
    });
  }

  return { ok: true, modelId };
}
