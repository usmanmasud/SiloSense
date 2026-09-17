import type { ComponentFeatures } from "./features";

export const SCORE_WEIGHTS = {
  concentration: 0.45,
  recency: 0.35,
  complexity: 0.2,
};

export type RiskLevel = "low" | "medium" | "elevated" | "high";

export function riskLevel(score: number): RiskLevel {
  if (score >= 80) return "high";
  if (score >= 60) return "elevated";
  if (score >= 40) return "medium";
  return "low";
}

export const ALERT_THRESHOLD = 70;

export type ComplexityInput = { sizeBytes: number; churnTotal: number };

/** Min-max normalises a set of raw numbers to [0, 1]. Ties/empty input map to 0.5. */
export function minMaxNormalize(raw: number[]): number[] {
  if (raw.length === 0) return [];
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-9) {
    return raw.map(() => 0.5);
  }
  return raw.map((r) => (r - min) / (max - min));
}

/**
 * Complexity is only meaningful relative to the rest of the repository, so
 * it's min-max normalised across every component in the same analysis run
 * rather than against a fixed scale.
 */
export function normalizeComplexity(inputs: ComplexityInput[]): number[] {
  const raw = inputs.map(
    (i) => Math.log(1 + i.sizeBytes) + Math.log(1 + i.churnTotal)
  );
  return minMaxNormalize(raw);
}

export type ScoreExplanation = {
  weights: typeof SCORE_WEIGHTS;
  contributions: {
    concentration: number;
    recency: number;
    complexity: number;
  };
  raw: {
    dominantShare: number;
    decayedShare: number;
    complexityNorm: number;
    entropy: number;
    totalCommits: number;
    totalContributors: number;
  };
  topContributors: ComponentFeatures["topContributors"];
};

export type ScoreResult = {
  score: number;
  level: RiskLevel;
  explanation: ScoreExplanation;
};

/**
 * Risk(component) = 100 x (w1*C + w2*R + w3*X)
 * C = dominant-contributor share of churn-weighted commits
 * R = recency-decayed concentration (half-life weighted)
 * X = complexity, normalised relative to the rest of the repository
 */
export function computeRiskScore(
  features: ComponentFeatures,
  complexityNorm: number
): ScoreResult {
  const cContribution = SCORE_WEIGHTS.concentration * features.dominantShare;
  const rContribution = SCORE_WEIGHTS.recency * features.decayedShare;
  const xContribution = SCORE_WEIGHTS.complexity * complexityNorm;

  const scoreRaw = (cContribution + rContribution + xContribution) * 100;
  const score = Math.max(0, Math.min(100, Math.round(scoreRaw * 10) / 10));

  return {
    score,
    level: riskLevel(score),
    explanation: {
      weights: SCORE_WEIGHTS,
      contributions: {
        concentration: Math.round(cContribution * 1000) / 10,
        recency: Math.round(rContribution * 1000) / 10,
        complexity: Math.round(xContribution * 1000) / 10,
      },
      raw: {
        dominantShare: features.dominantShare,
        decayedShare: features.decayedShare,
        complexityNorm,
        entropy: features.entropy,
        totalCommits: features.totalCommits,
        totalContributors: features.totalContributors,
      },
      topContributors: features.topContributors,
    },
  };
}
