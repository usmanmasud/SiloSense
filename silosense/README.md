# SiloSense

SiloSense mines a public Git repository's commit history and scores every
file from 0–100 on how concentrated the knowledge of it is in a small
number of contributors, so a team can see and address knowledge risk before
someone leaves and takes it with them.

This is a full-stack Next.js application — there is no separate backend
service. Everything (repository mining, feature engineering, scoring, a
from-scratch logistic-regression risk-prediction model, storage, and auth)
runs inside the same Node process as the web app.

## Requirements

- **Node.js 22.5+** (24 recommended) — the app uses the built-in
  [`node:sqlite`](https://nodejs.org/api/sqlite.html) module, so there is no
  native dependency to compile and nothing else to install.
- **`git`** available on the `PATH` — used directly to clone and mine
  repositories.

## Running it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The marketing site is
public; create an account at `/app/register` to analyze a repository.

Data is stored in a SQLite file at `data/silosense.db` (created
automatically, gitignored). Delete it to reset the app to a clean state.

## How an analysis works

1. **Mine** — `lib/git-mining.ts` does a bare `git clone` of the repository
   into a temp directory and runs `git log --numstat` to extract every
   commit's author, date, and per-file line changes, plus `git ls-tree` for
   current file sizes. The clone is deleted immediately after. To keep
   analysis bounded, only the most recent `SILOSENSE_MAX_COMMITS` commits
   (default 2000) and the 500 most-active files are processed — the UI
   surfaces when a repository's history was truncated.
2. **Engineer features** — `lib/features.ts` turns each file's raw commit
   events into a dominant-contributor share, a recency-decayed
   concentration measure (exponential half-life, so a contributor who's
   gone quiet stops "protecting" a file's score), and a diversity measure.
3. **Score** — `lib/scoring.ts` combines those with a complexity proxy
   (file size + total churn, normalised against the rest of the
   repository) into `Risk = 100 × (0.45·concentration + 0.35·recency +
   0.20·complexity)`, with a full breakdown stored per file so the
   dashboard can explain every score.
4. **Recommend & alert** — `lib/recommendations.ts` turns the score and
   features into concrete pairing/documentation suggestions; an alert is
   recorded whenever a file's score crosses the threshold (70) from below.
5. **Predict (optional)** — `lib/ml/*` and `lib/ml-pipeline.ts` slice a
   repository's stored commit history into time checkpoints, train a
   hand-written logistic regression to predict whether a file will be
   high-risk at the *next* checkpoint from only its *current* features, and
   evaluate it against a simple threshold baseline on a held-out, later
   time slice — a time-aware split, so no future information leaks into
   training.

All of this is re-derived from data already persisted in SQLite
(`commit_events`, `components`, `risk_scores`, …), so re-analyzing or
retraining never needs to re-clone unless you explicitly click
"Re-analyze".

## Known limitations

- No pull-request/code-review data is mined — only commit history. Review
  participation would require the GitHub REST API and its own rate limits;
  it's a natural extension, not implemented here.
- Renamed files are tracked as a delete + add, not a rename, to keep the
  mining step simple and fast.
- Complexity is a size/churn proxy, not a language-aware cyclomatic
  complexity measure.
- Large repositories are capped (see above) — this is a deliberate scope
  limit, not an accident, so a demo/marketing deployment stays responsive.

## Deploying

The app needs a persistent filesystem (for the SQLite file and for
temporary clone directories) and a long-lived Node process (analysis runs
in the background after its API call returns) — so it should be deployed
as a regular Node server (e.g. `next build && next start` on a VM,
Railway, Render, Fly.io, etc.), **not** to a serverless/edge platform.
