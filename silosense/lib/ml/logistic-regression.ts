/**
 * A small, dependency-free logistic regression implementation (batch
 * gradient descent with L2 regularisation). Written from scratch, rather
 * than pulled from a library, so every step of training is inspectable and
 * explainable for the risk-prediction extension described in the project
 * methodology.
 */

function sigmoid(z: number): number {
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

export function standardize(X: number[][]): {
  mean: number[];
  std: number[];
  Z: number[][];
} {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const mean = new Array(d).fill(0);
  const std = new Array(d).fill(0);

  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j];
  for (let j = 0; j < d; j++) mean[j] /= n || 1;

  for (const row of X)
    for (let j = 0; j < d; j++) std[j] += (row[j] - mean[j]) ** 2;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / (n || 1)) || 1;

  const Z = X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));
  return { mean, std, Z };
}

export function applyStandardize(
  X: number[][],
  mean: number[],
  std: number[]
): number[][] {
  return X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));
}

export function trainLogisticRegression(
  X: number[][],
  y: number[],
  opts: { epochs?: number; lr?: number; l2?: number } = {}
): { weights: number[]; bias: number } {
  const epochs = opts.epochs ?? 800;
  const lr = opts.lr ?? 0.15;
  const l2 = opts.l2 ?? 0.02;
  const n = X.length;
  const d = X[0]?.length ?? 0;

  const weights = new Array(d).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(d).fill(0);
    let gradB = 0;

    for (let i = 0; i < n; i++) {
      let z = bias;
      for (let j = 0; j < d; j++) z += weights[j] * X[i][j];
      const pred = sigmoid(z);
      const err = pred - y[i];
      for (let j = 0; j < d; j++) gradW[j] += err * X[i][j];
      gradB += err;
    }

    for (let j = 0; j < d; j++) {
      weights[j] -= lr * (gradW[j] / n + l2 * weights[j]);
    }
    bias -= lr * (gradB / n);
  }

  return { weights, bias };
}

export function predictProba(
  X: number[][],
  weights: number[],
  bias: number
): number[] {
  return X.map((row) => {
    let z = bias;
    for (let j = 0; j < weights.length; j++) z += weights[j] * row[j];
    return sigmoid(z);
  });
}
