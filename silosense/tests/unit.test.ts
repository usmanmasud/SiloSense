// Unit tests for SiloSense (Table 4.2 of the project report).
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseGitHubUrl } from "../lib/repo-url";
import {
  computeRiskScore,
  riskLevel,
  normalizeComplexity,
  ALERT_THRESHOLD,
} from "../lib/scoring";
import { computeComponentFeatures, type ComponentFeatures } from "../lib/features";
import { generateRecommendations } from "../lib/recommendations";
import { registerSchema } from "../lib/validation";
import { evaluateBinary } from "../lib/ml/metrics";
import { standardize, trainLogisticRegression, predictProba } from "../lib/ml/logistic-regression";
import { buildWindowedDataset } from "../lib/ml/windows";

const DAY = 86_400_000;

function features(overrides: Partial<ComponentFeatures> = {}): ComponentFeatures {
  return {
    totalCommits: 10,
    totalContributors: 2,
    entropy: 0.5,
    dominantShare: 0.5,
    decayedShare: 0.5,
    churnTotal: 100,
    lastCommitDate: new Date().toISOString(),
    daysSinceLastCommit: 1,
    topContributors: [
      { name: "Amina", email: "amina@example.com", commits: 8, churn: 80, weight: 80, share: 0.8 },
      { name: "Bello", email: "bello@example.com", commits: 2, churn: 20, weight: 20, share: 0.2 },
    ],
    ...overrides,
  };
}

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);

test("UT01 parseGitHubUrl accepts the four common URL forms", () => {
  for (const input of [
    "https://github.com/expressjs/cors",
    "https://github.com/expressjs/cors.git",
    "github.com/expressjs/cors",
    "expressjs/cors",
  ]) {
    assert.deepEqual(parseGitHubUrl(input), {
      owner: "expressjs",
      name: "cors",
      cloneUrl: "https://github.com/expressjs/cors.git",
    });
  }
});

test("UT02 parseGitHubUrl rejects invalid input", () => {
  for (const input of [
    "https://gitlab.com/expressjs/cors",
    "https://github.com/expressjs",
    "not a repository",
    "",
    "expressjs/co rs",
  ]) {
    assert.equal(parseGitHubUrl(input), null, `should reject "${input}"`);
  }
});

test("UT03 computeRiskScore gives 100 when C = R = X = 1", () => {
  const result = computeRiskScore(features({ dominantShare: 1, decayedShare: 1 }), 1);
  assert.equal(result.score, 100);
});

test("UT04 computeRiskScore gives 0 when C = R = X = 0", () => {
  const result = computeRiskScore(features({ dominantShare: 0, decayedShare: 0 }), 0);
  assert.equal(result.score, 0);
});

test("UT05 computeRiskScore matches the hand calculation (41.5, medium)", () => {
  // 100 x (0.45 x 0.5 + 0.35 x 0.4 + 0.20 x 0.25) = 41.5
  const result = computeRiskScore(features({ dominantShare: 0.5, decayedShare: 0.4 }), 0.25);
  assert.equal(result.score, 41.5);
  assert.equal(result.level, "medium");
});

test("UT06 riskLevel boundaries", () => {
  const cases: [number, string][] = [
    [0, "low"], [39.9, "low"],
    [40, "medium"], [59.9, "medium"],
    [60, "elevated"], [79.9, "elevated"],
    [80, "high"], [100, "high"],
  ];
  for (const [score, level] of cases) assert.equal(riskLevel(score), level, `score ${score}`);
});

test("UT07 computeComponentFeatures: 90 and 10 changed lines give C = 0.9", () => {
  const now = new Date();
  const date = now.toISOString();
  const f = computeComponentFeatures(
    [
      { date, authorKey: "a@example.com", authorName: "A", additions: 90, deletions: 0 },
      { date, authorKey: "b@example.com", authorName: "B", additions: 10, deletions: 0 },
    ],
    now
  );
  close(f.dominantShare, 0.9);
  assert.equal(f.topContributors[0].name, "A");
  assert.equal(f.totalContributors, 2);
});

test("UT08 computeComponentFeatures: recency decay gives C = 0.5 and R = 0.8", () => {
  // A: 100 lines 240 days ago -> 100 x 0.5^(240/120) = 25. B: 100 lines today -> 100.
  // R = 100 / (100 + 25) = 0.8
  const now = new Date();
  const f = computeComponentFeatures(
    [
      { date: new Date(now.getTime() - 240 * DAY).toISOString(), authorKey: "a@example.com", authorName: "A", additions: 100, deletions: 0 },
      { date: now.toISOString(), authorKey: "b@example.com", authorName: "B", additions: 100, deletions: 0 },
    ],
    now
  );
  close(f.dominantShare, 0.5);
  close(f.decayedShare, 0.8);
});

test("UT09 normalizeComplexity: equal values give 0.5; different values span 0 to 1", () => {
  const equal = normalizeComplexity([
    { sizeBytes: 500, churnTotal: 50 },
    { sizeBytes: 500, churnTotal: 50 },
    { sizeBytes: 500, churnTotal: 50 },
  ]);
  assert.deepEqual(equal, [0.5, 0.5, 0.5]);

  const [small, middle, large] = normalizeComplexity([
    { sizeBytes: 100, churnTotal: 10 },
    { sizeBytes: 1_000, churnTotal: 100 },
    { sizeBytes: 10_000, churnTotal: 1_000 },
  ]);
  assert.equal(small, 0);
  assert.equal(large, 1);
  assert.ok(middle > 0 && middle < 1);
});

test("UT10 generateRecommendations: low level gives no recommendations", () => {
  assert.deepEqual(generateRecommendations(features(), "low", 0.9), []);
});

test("UT11 generateRecommendations: one contributor at high level", () => {
  const only = features({
    totalContributors: 1,
    dominantShare: 1,
    topContributors: [{ name: "Amina", email: "amina@example.com", commits: 5, churn: 50, weight: 50, share: 1 }],
  });
  const recs = generateRecommendations(only, "high", 0.2);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].priority, "high");
  assert.match(recs[0].action, /only recorded contributor/);
});

test("UT12 generateRecommendations: pairs the main and second contributor", () => {
  const recs = generateRecommendations(features({ dominantShare: 0.8 }), "elevated", 0.2);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].priority, "medium");
  assert.match(recs[0].action, /Pair Amina \(80%.*\) with Bello/);
});

test("UT13 generateRecommendations: knowledge check after 200 days", () => {
  const recs = generateRecommendations(features({ daysSinceLastCommit: 200 }), "medium", 0.2);
  const check = recs.find((r) => /days ago/.test(r.action));
  assert.ok(check, "knowledge-check recommendation expected");
  assert.equal(check.priority, "low");
});

test("UT14 generateRecommendations: documentation advice only when X > 0.6", () => {
  const concentrated = features({ dominantShare: 0.9 });
  const withHighX = generateRecommendations(concentrated, "high", 0.7);
  const withLowX = generateRecommendations(concentrated, "high", 0.5);
  assert.ok(withHighX.some((r) => /secondary owner/.test(r.action)));
  assert.ok(!withLowX.some((r) => /secondary owner/.test(r.action)));
});

test("UT15 ALERT_THRESHOLD is 70", () => {
  assert.equal(ALERT_THRESHOLD, 70);
});

test("UT16 registerSchema rejects a short password and lower-cases the email", () => {
  const short = registerSchema.safeParse({ name: "Usman", email: "u@example.com", password: "short" });
  assert.equal(short.success, false);

  const valid = registerSchema.safeParse({ name: "Usman", email: "Usman@Example.COM", password: "password123" });
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.data.email, "usman@example.com");
});

test("UT17 evaluateBinary: accuracy, precision, recall and F1 of 0.5; AUC 0.75", () => {
  const m = evaluateBinary([1, 1, 0, 0], [0.9, 0.4, 0.6, 0.1], 0.5);
  assert.equal(m.accuracy, 0.5);
  assert.equal(m.precision, 0.5);
  assert.equal(m.recall, 0.5);
  assert.equal(m.f1, 0.5);
  assert.equal(m.auc, 0.75);
});

test("UT18 trainLogisticRegression learns a separable one-feature example", () => {
  const X = [[0.1], [0.2], [0.3], [0.4], [0.6], [0.7], [0.8], [0.9]];
  const y = [0, 0, 0, 0, 1, 1, 1, 1];
  const { Z } = standardize(X);
  const { weights, bias } = trainLogisticRegression(Z, y);
  const predicted = predictProba(Z, weights, bias).map((p) => (p >= 0.5 ? 1 : 0));
  assert.deepEqual(predicted, y);
});

test("UT19 buildWindowedDataset refuses a history of only 30 days", () => {
  const last = new Date();
  const first = new Date(last.getTime() - 30 * DAY);
  const histories = [
    {
      componentId: "comp_1",
      events: [
        { date: first.toISOString(), authorKey: "a@example.com", authorName: "A", additions: 10, deletions: 0 },
        { date: last.toISOString(), authorKey: "a@example.com", authorName: "A", additions: 10, deletions: 0 },
      ],
    },
  ];
  assert.equal(buildWindowedDataset(histories, first, last), null);
});
