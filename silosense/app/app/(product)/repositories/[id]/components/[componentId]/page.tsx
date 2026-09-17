import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getComponentById,
  getScoreHistoryForComponent,
  getRecommendationsForScore,
  getLatestMlModel,
  getMlPredictionForComponent,
} from "@/lib/queries";
import { formatDate, formatRelativeTime, riskBadgeClasses } from "@/lib/format";
import { ScoreHistoryChart } from "@/components/score-history-chart";
import type { ScoreExplanation } from "@/lib/scoring";

export const metadata: Metadata = { title: "Component detail" };

export default async function ComponentDetailPage({
  params,
}: {
  params: Promise<{ id: string; componentId: string }>;
}) {
  const { id, componentId } = await params;
  const user = await getCurrentUser();

  const component = getComponentById(componentId);
  if (!component || component.repository_id !== id) notFound();

  const repository = db
    .prepare(`SELECT id, owner, name, user_id FROM repositories WHERE id = ?`)
    .get(component.repository_id) as
    | { id: string; owner: string; name: string; user_id: string }
    | undefined;
  if (!repository || repository.user_id !== user!.id) notFound();

  const history = getScoreHistoryForComponent(component.id);
  const latest = history[history.length - 1];
  if (!latest) notFound();

  const explanation: ScoreExplanation = JSON.parse(latest.explanation_json);
  const recommendations = getRecommendationsForScore(latest.id);
  const mlModel = getLatestMlModel(repository.id);
  const prediction = mlModel ? getMlPredictionForComponent(component.id, mlModel.id) : null;

  const contributionRows = [
    { label: "Concentration", value: explanation.contributions.concentration, max: explanation.weights.concentration * 100 },
    { label: "Recency", value: explanation.contributions.recency, max: explanation.weights.recency * 100 },
    { label: "Complexity", value: explanation.contributions.complexity, max: explanation.weights.complexity * 100 },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/app/repositories/${repository.id}`}
        className="text-xs font-medium text-muted-foreground hover:text-brand-primary"
      >
        ← {repository.owner}/{repository.name}
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <h1 className="break-all font-mono text-lg font-semibold text-foreground">
          {component.path}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-3xl font-semibold text-foreground">{latest.score}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${riskBadgeClasses(latest.risk_level)}`}>
            {latest.risk_level}
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Last observed {formatRelativeTime(latest.observation_date)}
      </p>

      {prediction && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          <span className="font-medium text-foreground">Predicted trend:</span>
          <span className="text-muted-foreground">
            {Math.round(prediction.probability * 100)}% probability of being high-risk at the
            next checkpoint
            {prediction.label === 1 ? " — flagged" : ""}
          </span>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">Why this score</h2>
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
          {contributionRows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">{row.label}</span>
                <span className="text-muted-foreground">
                  {row.value.toFixed(1)} / {row.max.toFixed(0)} pts
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-border">
                <div
                  className="h-1.5 rounded-full bg-brand-accent"
                  style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
          <dl className="mt-2 grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Commits</dt>
              <dd className="font-medium text-foreground">{explanation.raw.totalCommits}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contributors</dt>
              <dd className="font-medium text-foreground">{explanation.raw.totalContributors}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dominant share</dt>
              <dd className="font-medium text-foreground">
                {Math.round(explanation.raw.dominantShare * 100)}%
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Diversity (entropy)</dt>
              <dd className="font-medium text-foreground">
                {explanation.raw.entropy.toFixed(2)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">Contributors</h2>
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-background p-5">
          {explanation.topContributors.map((c) => (
            <div key={c.email} className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[10px] font-semibold text-white">
                {c.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{c.name}</span>
                  <span className="text-muted-foreground">
                    {Math.round(c.share * 100)}% · {c.commits} commits
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-border">
                  <div
                    className="h-1.5 rounded-full bg-brand-primary"
                    style={{ width: `${c.share * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">Risk history</h2>
        <div className="mt-3 rounded-xl border border-border bg-background p-5">
          <ScoreHistoryChart
            points={history.map((h) => ({ date: h.observation_date, score: h.score }))}
          />
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Recommendations</h2>
          <div className="mt-3 flex flex-col gap-3">
            {recommendations.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-background p-4"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeClasses(
                    r.priority === "high" ? "high" : r.priority === "medium" ? "elevated" : "medium"
                  )}`}
                >
                  {r.priority} priority
                </span>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{r.action}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        First observed {formatDate(history[0].observation_date)}
      </p>
    </div>
  );
}
