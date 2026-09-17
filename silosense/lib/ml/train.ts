import { buildWindowedDataset, ML_FEATURE_NAMES, type ComponentHistory } from "./windows";
import {
  standardize,
  applyStandardize,
  trainLogisticRegression,
  predictProba,
} from "./logistic-regression";
import { evaluateBinary, type ClassificationMetrics } from "./metrics";

const TEST_WINDOW_FRACTION = 0.25;
const BASELINE_THRESHOLD = 0.6;

export type TrainSuccess = {
  ok: true;
  featureNames: readonly string[];
  weights: number[];
  bias: number;
  mean: number[];
  std: number[];
  nWindows: number;
  nTrain: number;
  nTest: number;
  metrics: { model: ClassificationMetrics; baseline: ClassificationMetrics };
};

export type TrainFailure = { ok: false; reason: string };

export type TrainResult = TrainSuccess | TrainFailure;

/**
 * Trains a logistic regression on time-windowed repository history and
 * compares it against a fixed-threshold "dominant contributor share"
 * baseline, using a time-aware split (earlier windows for training, the
 * most recent windows held out for testing) so later history never leaks
 * into a model that has to predict earlier history.
 */
export function trainRiskModel(
  histories: ComponentHistory[],
  repoFirstDate: Date,
  repoLastDate: Date
): TrainResult {
  const dataset = buildWindowedDataset(histories, repoFirstDate, repoLastDate);
  if (!dataset) {
    return {
      ok: false,
      reason:
        "This repository's mined history is too short to build reliable time windows (need at least ~60 days of activity).",
    };
  }

  const maxWindowIndex = Math.max(...dataset.examples.map((e) => e.windowIndex));
  const splitAt = Math.max(1, Math.round(maxWindowIndex * (1 - TEST_WINDOW_FRACTION)));

  const trainEx = dataset.examples.filter((e) => e.windowIndex < splitAt);
  const testEx = dataset.examples.filter((e) => e.windowIndex >= splitAt);

  if (trainEx.length < 10 || testEx.length < 5) {
    return {
      ok: false,
      reason:
        "Not enough component-history observations yet to train and evaluate a model reliably. Try a repository with more files or a longer commit history.",
    };
  }

  const Xtrain = trainEx.map((e) => e.featureVector);
  const ytrain = trainEx.map((e) => e.label);
  const Xtest = testEx.map((e) => e.featureVector);
  const ytest = testEx.map((e) => e.label);

  const { mean, std, Z: Ztrain } = standardize(Xtrain);
  const Ztest = applyStandardize(Xtest, mean, std);

  const { weights, bias } = trainLogisticRegression(Ztrain, ytrain, {
    epochs: 800,
    lr: 0.15,
    l2: 0.02,
  });

  const testProbs = predictProba(Ztest, weights, bias);
  const modelMetrics = evaluateBinary(ytest, testProbs, 0.5);

  // Baseline: a fixed-threshold classifier on raw dominant-contributor share
  // alone (feature index 0), the simplest plausible non-ML predictor.
  const baselineScores = testEx.map((e) => e.featureVector[0]);
  const baselineMetrics = evaluateBinary(ytest, baselineScores, BASELINE_THRESHOLD);

  return {
    ok: true,
    featureNames: ML_FEATURE_NAMES,
    weights,
    bias,
    mean,
    std,
    nWindows: dataset.checkpoints.length,
    nTrain: trainEx.length,
    nTest: testEx.length,
    metrics: { model: modelMetrics, baseline: baselineMetrics },
  };
}

export function predictWithModel(
  featureVector: number[],
  model: { weights: number[]; bias: number; mean: number[]; std: number[] }
): number {
  const z = featureVector.map((v, j) => (v - model.mean[j]) / model.std[j]);
  const [p] = predictProba([z], model.weights, model.bias);
  return p;
}
