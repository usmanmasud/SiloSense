import { computeComponentFeatures, type ComponentEvent, type ComponentFeatures } from "../features";
import { computeRiskScore, minMaxNormalize, ALERT_THRESHOLD } from "../scoring";

export const MIN_CHECKPOINTS = 5;
const MAX_CHECKPOINTS = 9;

export const ML_FEATURE_NAMES = [
  "dominantShare",
  "decayedShare",
  "entropy",
  "logContributors",
  "logCommits",
  "churnComplexity",
] as const;

export type ComponentHistory = {
  componentId: string;
  events: ComponentEvent[]; // full history, oldest first
};

export type WindowExample = {
  componentId: string;
  windowIndex: number;
  featureVector: number[];
  label: number;
};

export type WindowedDataset = {
  checkpoints: Date[];
  examples: WindowExample[];
};

export function toVector(f: ComponentFeatures, churnComplexityNorm: number): number[] {
  return [
    f.dominantShare,
    f.decayedShare,
    f.entropy,
    Math.log(1 + f.totalContributors),
    Math.log(1 + f.totalCommits),
    churnComplexityNorm,
  ];
}

/**
 * Slices each component's commit history at a series of evenly spaced
 * checkpoints and turns consecutive checkpoint pairs into (features now,
 * label at the next checkpoint) training examples. The label is whether the
 * component's rule-based risk score at checkpoint i+1 meets the alert
 * threshold - always computed from information at or before i+1, and always
 * predicted from information at or before i, so no future information leaks
 * into a training example's input features.
 */
export function buildWindowedDataset(
  histories: ComponentHistory[],
  repoFirstDate: Date,
  repoLastDate: Date
): WindowedDataset | null {
  const spanDays =
    (repoLastDate.getTime() - repoFirstDate.getTime()) / 86_400_000;
  if (spanDays < 60) return null;

  const checkpointCount = Math.max(
    MIN_CHECKPOINTS,
    Math.min(MAX_CHECKPOINTS, Math.round(spanDays / 30))
  );

  const checkpoints: Date[] = [];
  for (let i = 1; i <= checkpointCount; i++) {
    const t =
      repoFirstDate.getTime() +
      ((repoLastDate.getTime() - repoFirstDate.getTime()) * i) /
        checkpointCount;
    checkpoints.push(new Date(t));
  }
  if (checkpoints.length < MIN_CHECKPOINTS) return null;

  const componentIds = histories.map((h) => h.componentId);
  const featuresByComponent = new Map<string, ComponentFeatures[]>();

  for (const h of histories) {
    const perCheckpoint = checkpoints.map((cp) =>
      computeComponentFeatures(
        h.events.filter((e) => new Date(e.date) <= cp),
        cp
      )
    );
    featuresByComponent.set(h.componentId, perCheckpoint);
  }

  // Normalise the churn-based complexity proxy within each checkpoint,
  // across whichever components already have commits by that point.
  const churnNormByCheckpoint: number[][] = checkpoints.map((_, ci) => {
    const raw = componentIds.map((id) => {
      const f = featuresByComponent.get(id)![ci];
      return f.totalCommits > 0 ? Math.log(1 + f.churnTotal) : NaN;
    });
    const validIdx = raw
      .map((v, idx) => (Number.isFinite(v) ? idx : -1))
      .filter((idx) => idx >= 0);
    const normValid = minMaxNormalize(validIdx.map((idx) => raw[idx]));
    const full = new Array(componentIds.length).fill(0);
    validIdx.forEach((idx, k) => (full[idx] = normValid[k]));
    return full;
  });

  const examples: WindowExample[] = [];

  componentIds.forEach((id, ci) => {
    const perCheckpoint = featuresByComponent.get(id)!;
    for (let i = 0; i < checkpoints.length - 1; i++) {
      const f = perCheckpoint[i];
      if (f.totalCommits === 0) continue;

      const nextF = perCheckpoint[i + 1];
      const nextChurnNorm = churnNormByCheckpoint[i + 1][ci];
      const { score } = computeRiskScore(nextF, nextChurnNorm);
      const label = score >= ALERT_THRESHOLD ? 1 : 0;

      examples.push({
        componentId: id,
        windowIndex: i,
        featureVector: toVector(f, churnNormByCheckpoint[i][ci]),
        label,
      });
    }
  });

  return { checkpoints, examples };
}
