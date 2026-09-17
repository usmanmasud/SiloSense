export type ClassificationMetrics = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number | null;
  n: number;
  positives: number;
};

/** Exact AUC via the Mann-Whitney U statistic (rank-based, no library needed). */
function computeAuc(yTrue: number[], scores: number[]): number | null {
  const pos: number[] = [];
  const neg: number[] = [];
  for (let i = 0; i < yTrue.length; i++) {
    (yTrue[i] === 1 ? pos : neg).push(scores[i]);
  }
  if (pos.length === 0 || neg.length === 0) return null;

  let concordant = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p > n) concordant += 1;
      else if (p === n) concordant += 0.5;
    }
  }
  return concordant / (pos.length * neg.length);
}

export function evaluateBinary(
  yTrue: number[],
  scores: number[],
  threshold = 0.5
): ClassificationMetrics {
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;

  for (let i = 0; i < yTrue.length; i++) {
    const pred = scores[i] >= threshold ? 1 : 0;
    if (pred === 1 && yTrue[i] === 1) tp++;
    else if (pred === 1 && yTrue[i] === 0) fp++;
    else if (pred === 0 && yTrue[i] === 0) tn++;
    else fn++;
  }

  const accuracy = (tp + tn) / (yTrue.length || 1);
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    accuracy,
    precision,
    recall,
    f1,
    auc: computeAuc(yTrue, scores),
    n: yTrue.length,
    positives: yTrue.filter((v) => v === 1).length,
  };
}
