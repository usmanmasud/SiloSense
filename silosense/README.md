# SiloSense

SiloSense mines a public Git repository's commit history and scores every
file from 0–100 on how concentrated the knowledge of it is in a small
number of contributors, so a team can see and address knowledge risk before
someone leaves and takes it with them.

This is a full-stack Next.js application — there is no separate backend
service. Everything (repository mining, feature engineering, scoring, a
from-scratch logistic-regression risk-prediction model, auth, plans, and an
admin dashboard) runs inside the same Node process as the web app, backed
by Postgres.

## Requirements

- **Node.js 24+**, pinned via `.node-version` and `package.json#engines`.
- **`git`** available on the `PATH` — used directly to clone and mine
  repositories.
- **A Postgres database.** [Neon](https://neon.tech) has a generous free
  tier and gives you a connection string in about a minute with no local
  install; Render's own managed Postgres works too (see deployment below).

## Running it

```bash
npm install
```

Create `.env.local`:

```
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The marketing site is
public; create an account at `/app/register` to analyze a repository. The
schema is created automatically against `DATABASE_URL` on first request —
nothing to migrate by hand.

To make your account an admin (unlocks `/app/admin`), set
`SILOSENSE_ADMIN_EMAILS=you@example.com` (comma-separated for more than
one) before registering that account.

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
5. **Predict (Pro plan)** — `lib/ml/*` and `lib/ml-pipeline.ts` slice a
   repository's stored commit history into time checkpoints, train a
   hand-written logistic regression to predict whether a file will be
   high-risk at the *next* checkpoint from only its *current* features, and
   evaluate it against a simple threshold baseline on a held-out, later
   time slice — a time-aware split, so no future information leaks into
   training.

All of this is re-derived from data already persisted (`commit_events`,
`components`, `risk_scores`, …), so re-analyzing or retraining never needs
to re-clone unless you explicitly click "Re-analyze".

## Data layer

**Postgres, not MongoDB.** This data is inherently relational — users own
repositories, repositories own components, components accumulate a
time-series of risk_scores, and everything cascades on delete — so it's
modelled as foreign-keyed tables with `ON DELETE CASCADE`, not documents.
The "latest score per file" queries lean on a real window function
(`ROW_NUMBER() OVER (PARTITION BY component_id ...)`), which Postgres has
and MongoDB doesn't have a clean equivalent for. There's no ORM: `lib/db.ts`
is a thin wrapper around `pg` (`query`/`queryOne`, plus a `bulkValues`
helper for multi-row inserts), so every query is plain, inspectable SQL.

**The analysis queue is claimed safely at the database level.**
`lib/analysis.ts`'s `pumpQueue()` claims the next queued run with:

```sql
UPDATE analysis_runs SET status = 'running'
WHERE id = (
  SELECT id FROM analysis_runs WHERE status = 'pending'
  ORDER BY started_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
)
RETURNING id
```

`FOR UPDATE SKIP LOCKED` is the standard Postgres job-queue pattern — it
guarantees a run is never picked up twice even if this were ever called
from more than one process at once. An in-process counter additionally
caps how many analyses *this* instance runs concurrently
(`SILOSENSE_MAX_CONCURRENT_ANALYSES`, default 2); that part is a soft,
per-instance limit, not a correctness mechanism.

## Plans & monetization (scaffolding)

`lib/plans.ts` defines Free and Pro tiers (repository cap, analyses/hour,
whether ML training is available) and every limit in the app reads from
it. There's no live payment processor wired up yet: `POST
/api/billing/upgrade` (used by the "Upgrade to Pro" button on `/app/account`)
just sets `users.plan` directly, so the gating is real and testable today.
Wiring up real billing later means pointing that button at a Stripe
Checkout session and setting `plan` from a webhook instead — nothing that
*reads* `plan` needs to change.

## Admin dashboard

Visiting `/app/admin` (only reachable by a user with `users.is_admin =
true`, see "Running it" above) gives:

- **Overview** — user/repo/run counts, queue depth, failures in the last 24h.
- **Users** — every account, with inline plan changes, suspend/unsuspend,
  and delete.
- **System** — the last 50 analysis runs across all users, with status and
  error messages, for debugging mining failures in production.
- **Billing** — plan distribution and an estimated MRR figure, clearly
  labelled as based on manually-set plans until real billing exists.
- **Repositories** — every analyzed repository across all users, with a
  moderation "Remove" action.

## Production hardening

These exist specifically because this app is meant to take real signups
from strangers, not just run as a local demo:

- **Analysis queue** — see "Data layer" above.
- **Crash/restart recovery** — on first query after startup, any run stuck
  in `running` for more than 15 minutes (from a previous process that died
  mid-analysis) is marked `failed` with an explanatory message instead of
  hanging forever, and any genuinely-still-`pending` runs are resumed.
- **Rate limiting** — `lib/rate-limit.ts` is an in-memory limiter (fine for
  a single instance; would need a shared store like Redis if this were ever
  scaled to multiple instances) applied to login (by IP and by email,
  brute-force protection), registration, password-reset requests, and
  triggering an analysis (limits vary by plan).
- **Per-plan repository cap** — stops one account from queuing unlimited
  analyses; see `lib/plans.ts`.
- **Account suspension** — an admin-suspended user is signed out of every
  session immediately and can't log back in until unsuspended.
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
  limit, not an accident, so the app stays responsive under real traffic.
- Billing is scaffolding (see above) — no card is ever charged by this
  codebase as it stands.
- Rate limiting and the analysis queue's in-process concurrency cap are
  per-instance; running more than one server instance needs those moved to
  a shared store (Redis) first — see "Deploying to Render".

## Deploying to Render

This needs a long-lived Node process (analysis runs in the background
after its API call returns), so it's deployed as a regular always-on web
service, **not** to a serverless/edge platform.

1. Push this repo to GitHub, then in Render: **New > Blueprint**, point it
   at the repo. Render reads [`render.yaml`](../render.yaml) at the repo
   root, which provisions a managed Postgres database, links its
   connection string into the web service as `DATABASE_URL` automatically,
   and sets the build/start commands and working directory (`silosense/`).
2. In the service's **Environment** tab, set:
   - `RESEND_API_KEY` — from a free [Resend](https://resend.com) account,
     needed for password-reset emails to actually send. Until this is set,
     reset links are only logged to Render's server logs, not emailed —
     fine for your own testing, not for real users who forget a password.
   - `RESEND_FROM_EMAIL` — optional, defaults to Resend's shared
     `onboarding@resend.dev` sender, which works without verifying a
     domain but is best swapped for your own once you have one.
   - `SILOSENSE_ADMIN_EMAILS` — comma-separated emails that should become
     admins on registration.
3. Deploy. The schema is created automatically against the managed
   Postgres database on first request — nothing else to run.
4. Optional tuning via environment variables, all have sane defaults:
   `SILOSENSE_MAX_COMMITS`, `SILOSENSE_MAX_CONCURRENT_ANALYSES`,
   `SILOSENSE_CLONE_TIMEOUT_MS`.

Because rate limiting and the per-instance concurrency cap are in-memory,
keep this to a **single Render instance** (no horizontal autoscaling)
unless those are rebuilt on Redis first — the database layer itself
(Postgres + `SKIP LOCKED` queue claiming) is already safe for that, it's
specifically those two in-memory pieces that aren't yet.
