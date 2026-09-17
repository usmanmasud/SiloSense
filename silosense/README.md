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

- **Node.js 24+** — the app uses the built-in
  [`node:sqlite`](https://nodejs.org/api/sqlite.html) module, so there is no
  native dependency to compile and nothing else to install. (Pinned via
  `.node-version` and `package.json#engines`.)
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

## Production hardening

These exist specifically because this app is meant to take real signups
from strangers, not just run as a local demo:

- **Analysis queue** — `lib/analysis.ts` runs at most
  `SILOSENSE_MAX_CONCURRENT_ANALYSES` (default 2) analyses at once across
  *all* users; extra requests queue as `pending` runs and start as slots
  free up, so a burst of signups can't all `git clone` and score at the
  same time on one process.
- **Crash/restart recovery** — on startup, any run stuck in `running`
  (from a previous process that died mid-analysis) is marked `failed` with
  an explanatory message instead of hanging forever, and any `pending` runs
  left in the queue are resumed.
- **Rate limiting** — `lib/rate-limit.ts` is an in-memory limiter (fine for
  a single instance; would need a shared store like Redis if this were ever
  scaled to multiple instances) applied to login (by IP and by email,
  brute-force protection), registration, password-reset requests, and
  triggering an analysis.
- **Per-user repository cap** — `SILOSENSE_MAX_REPOS_PER_USER` (default 15)
  stops one account from queuing unlimited analyses.
- **Password reset** — `lib/email.ts` sends via the
  [Resend](https://resend.com) HTTP API. Without `RESEND_API_KEY` set, it
  logs the reset link to the server console instead of emailing it, so the
  flow is testable locally with no account needed. The reset endpoint
  always returns the same response whether or not the email is registered,
  so it can't be used to enumerate accounts; consuming a reset token
  signs the account out everywhere.

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

## Deploying to Render

The app needs a persistent filesystem (for the SQLite file — temp clone
directories don't need to persist) and a long-lived Node process (analysis
runs in the background after its API call returns), so it's deployed as a
regular always-on web service, **not** to a serverless/edge platform.

1. Push this repo to GitHub, then in Render: **New > Blueprint**, point it
   at the repo. Render will read [`render.yaml`](../render.yaml) at the
   repo root, which already sets the build/start commands, the working
   directory (`silosense/`), and a 1 GB persistent disk mounted at
   `/var/data`.
2. **The disk requires a paid instance type** — `render.yaml` requests the
   `starter` plan. Render's free web services don't support persistent
   disks *and* spin down when idle (which would kill an in-progress
   analysis), so free tier isn't viable for real usage here.
3. In the service's **Environment** tab, set:
   - `RESEND_API_KEY` — from a free [Resend](https://resend.com) account,
     needed for password-reset emails to actually send. Until this is set,
     reset links are only logged to Render's server logs, not emailed —
     fine for your own testing, not for real users who forget a password.
   - `RESEND_FROM_EMAIL` — optional, defaults to Resend's shared
     `onboarding@resend.dev` sender, which works without verifying a
     domain but is best swapped for your own once you have one.
4. Deploy. First boot creates the SQLite schema automatically on the
   mounted disk — nothing else to run.
5. Optional tuning via environment variables, all have sane defaults:
   `SILOSENSE_MAX_COMMITS`, `SILOSENSE_MAX_CONCURRENT_ANALYSES`,
   `SILOSENSE_MAX_REPOS_PER_USER`, `SILOSENSE_CLONE_TIMEOUT_MS`.

Because rate limiting and the analysis queue are in-memory, keep this to a
**single Render instance** (no horizontal autoscaling) unless that's
rebuilt on a shared store first.
