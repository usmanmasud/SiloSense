import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How SiloSense's 0–100 knowledge-concentration risk score is calculated, and how the system is evaluated.",
};

const signals = [
  {
    key: "C",
    name: "Contributor concentration",
    body:
      "How unevenly a component's changes are distributed across its contributors. A file touched almost entirely by one developer scores higher than one with balanced contribution.",
  },
  {
    key: "R",
    name: "Recency",
    body:
      "How recently the component's primary contributors were active. Knowledge tied to contributors who have gone quiet is treated as more fragile.",
  },
  {
    key: "X",
    name: "Complexity",
    body:
      "A complexity-related weighting (e.g. size, churn, or structural complexity) that reflects how costly a component would be to re-learn from scratch.",
  },
];

const evalSteps = [
  "Select approximately 5–10 open-source repositories with accessible history.",
  "Run SiloSense against each repository to generate component-level risk scores.",
  "Compare flagged components against known contributor departures or inactivity in the repository history.",
  "Collect developer feedback on whether flagged components match their own sense of risk.",
];

export default function MethodologyPage() {
  return (
    <div>
      <section className="border-b border-border bg-muted">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-accent">
            Methodology
          </span>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            How the risk score is calculated
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            The score is designed to be reproducible: given the same
            repository history, it always produces the same result.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-xl font-semibold text-foreground">
          The three signals
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Every component is scored on a 0–100 scale from three weighted
          signals, each derived directly from repository history.
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {signals.map((s) => (
            <div
              key={s.key}
              className="rounded-xl border border-border bg-background p-6"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary text-sm font-semibold text-white">
                {s.key}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {s.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-border bg-brand-primary p-8">
          <span className="text-xs font-medium uppercase tracking-wide text-white/60">
            Baseline formula
          </span>
          <p className="mt-3 overflow-x-auto whitespace-nowrap font-mono text-sm text-white">
            Risk(component) = 100 × (w₁·C + w₂·R + w₃·X)
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
            where C, R, and X are normalised to [0, 1] and w₁ + w₂ + w₃ = 1.
            Weights are tuned during evaluation rather than fixed in
            advance, so the formula can be recalibrated per project.
          </p>
        </div>

        <div className="mt-16">
          <h2 className="text-xl font-semibold text-foreground">
            Evaluation approach
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            The system is evaluated against real repository history rather
            than synthetic data, so flagged risk can be checked against what
            actually happened.
          </p>
          <ol className="mt-6 flex flex-col gap-4">
            {evalSteps.map((step, i) => (
              <li key={step} className="flex gap-4">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-brand-primary">
                  {i + 1}
                </span>
                <span className="text-sm leading-6 text-muted-foreground">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-16 rounded-xl border border-border bg-muted p-6">
          <h3 className="text-sm font-semibold text-foreground">
            Scope note
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            SiloSense is designed to make knowledge-concentration risk
            visible, not to judge individual developers or replace overall
            software-quality analysis. It is not intended to inform
            employment decisions.
          </p>
        </div>
      </section>
    </div>
  );
}
