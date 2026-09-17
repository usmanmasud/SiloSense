import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  getRepositoryForUser,
  getLatestRun,
  getLatestScoresForRepository,
  getAlertsForRepository,
  getLatestMlModel,
} from "@/lib/queries";
import { formatRelativeTime, riskBadgeClasses, riskDotClasses, runStatusClasses, runStatusLabel } from "@/lib/format";
import { PollRefresh } from "@/components/poll-refresh";
import { ReanalyzeButton } from "@/components/reanalyze-button";
import { TrainModelButton } from "@/components/train-model-button";
import { AckAlertButton } from "@/components/ack-alert-button";

export const metadata: Metadata = { title: "Repository" };

export default async function RepositoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  const repository = getRepositoryForUser(user!.id, id);
  if (!repository) notFound();

  const latestRun = getLatestRun(repository.id);
  const inProgress = latestRun?.status === "pending" || latestRun?.status === "running";
  const scores = latestRun?.status === "completed" ? getLatestScoresForRepository(repository.id) : [];
  const alerts = getAlertsForRepository(repository.id, 15);
  const mlModel = getLatestMlModel(repository.id);
  const mlMetrics = mlModel ? JSON.parse(mlModel.metrics_json) : null;

  const highRisk = scores.filter((s) => s.risk_level === "high").length;
  const avgScore = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : null;
  const topRisk = scores.slice(0, 15);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <PollRefresh active={inProgress} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/app/repositories"
            className="text-xs font-medium text-muted-foreground hover:text-brand-primary"
          >
            ← Repositories
          </Link>
          <h1 className="mt-1 font-mono text-xl font-semibold text-foreground">
            {repository.owner}/{repository.name}
          </h1>
          {latestRun && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${runStatusClasses(latestRun.status)}`}>
                {runStatusLabel(latestRun.status)}
              </span>
              <span className="text-xs text-muted-foreground">
                started {formatRelativeTime(latestRun.started_at)}
              </span>
            </div>
          )}
        </div>
        <ReanalyzeButton repositoryId={repository.id} />
      </div>

      {inProgress && (
        <div className="mt-8 rounded-xl border border-border bg-background p-6 text-sm text-muted-foreground">
          Mining repository history and computing risk scores — this page
          will update automatically. Larger repositories can take a few
          minutes.
        </div>
      )}

      {latestRun?.status === "failed" && (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-medium text-red-800">Analysis failed</p>
          <p className="mt-1 text-sm text-red-700">{latestRun.error}</p>
        </div>
      )}

      {latestRun?.status === "completed" && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Commits analyzed" value={latestRun.commit_count ?? 0} />
            <Stat label="Files scored" value={latestRun.component_count ?? 0} />
            <Stat label="High risk" value={highRisk} accent />
            <Stat label="Average score" value={avgScore ?? "—"} />
          </div>

          {!!latestRun.truncated && (
            <p className="mt-3 text-xs text-muted-foreground">
              This repository has more history than the analysis window
              covers — results are based on the most recent commits and most
              active files only.
            </p>
          )}

          <section className="mt-10">
            <h2 className="text-sm font-semibold text-foreground">
              Repository heatmap
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every scored file, coloured by risk. Click a cell for details.
            </p>
            <div className="mt-4 grid grid-cols-10 gap-1.5 sm:grid-cols-16 md:grid-cols-20">
              {scores.map((s) => (
                <Link
                  key={s.component_id}
                  href={`/app/repositories/${repository.id}/components/${s.component_id}`}
                  title={`${s.component_path} — ${s.score}/100`}
                  className={`aspect-square rounded-sm transition-transform hover:scale-110 ${riskDotClasses(s.risk_level)}`}
                />
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-sm font-semibold text-foreground">
              Highest-risk files
            </h2>
            <div className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
              {topRisk.map((s) => (
                <Link
                  key={s.component_id}
                  href={`/app/repositories/${repository.id}/components/${s.component_id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted"
                >
                  <span className="truncate font-mono text-xs text-foreground sm:text-sm">
                    {s.component_path}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-foreground">{s.score}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${riskBadgeClasses(s.risk_level)}`}>
                      {s.risk_level}
                    </span>
                  </span>
                </Link>
              ))}
              {topRisk.length === 0 && (
                <p className="px-4 py-6 text-sm text-muted-foreground">
                  No components were scored.
                </p>
              )}
            </div>
          </section>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="text-sm font-semibold text-foreground">Alerts</h2>
              <div className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
                {alerts.length === 0 && (
                  <p className="px-4 py-6 text-sm text-muted-foreground">
                    No components have crossed the risk threshold yet.
                  </p>
                )}
                {alerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-foreground">
                        {a.component_path}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.previous_score !== null ? `${Math.round(a.previous_score)} → ` : ""}
                        {Math.round(a.new_score)} · {formatRelativeTime(a.created_at)}
                      </p>
                    </div>
                    {a.acknowledged ? (
                      <span className="shrink-0 text-xs text-muted-foreground">Acknowledged</span>
                    ) : (
                      <AckAlertButton alertId={a.id} />
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-foreground">
                Risk-prediction model
              </h2>
              <div className="mt-4 rounded-xl border border-border bg-background p-5">
                {mlModel && mlMetrics ? (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Trained {formatRelativeTime(mlModel.trained_at)} on {mlModel.n_windows} time
                      checkpoints
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <MetricColumn title="Model" metrics={mlMetrics.model} />
                      <MetricColumn title="Baseline" metrics={mlMetrics.baseline} />
                    </div>
                    <div className="mt-4">
                      <TrainModelButton repositoryId={repository.id} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Train a lightweight logistic-regression model on this
                      repository&apos;s history to predict which files are
                      likely to become high-risk next, and compare it
                      against a simple baseline.
                    </p>
                    <div className="mt-4">
                      <TrainModelButton repositoryId={repository.id} />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className={`text-2xl font-semibold ${accent ? "text-brand-accent" : "text-foreground"}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function MetricColumn({
  title,
  metrics,
}: {
  title: string;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    auc: number | null;
  };
}) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <dl className="mt-2 flex flex-col gap-1 text-xs">
        <Row label="F1" value={pct(metrics.f1)} />
        <Row label="Precision" value={pct(metrics.precision)} />
        <Row label="Recall" value={pct(metrics.recall)} />
        <Row label="Accuracy" value={pct(metrics.accuracy)} />
        <Row label="AUC" value={metrics.auc !== null ? metrics.auc.toFixed(2) : "—"} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
