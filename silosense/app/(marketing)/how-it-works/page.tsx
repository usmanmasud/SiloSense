import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "From connecting a repository to receiving pairing recommendations — the SiloSense pipeline in six steps.",
};

const steps = [
  {
    title: "Connect a repository",
    body:
      "A team points SiloSense at a Git-based repository, authenticating with the GitHub or GitLab API so history and metadata can be read.",
  },
  {
    title: "Mine commit, blame & review history",
    body:
      "SiloSense walks the commit log, blame data, and pull-request/review activity to build a per-file record of who has worked on what, and when.",
  },
  {
    title: "Compute the risk score",
    body:
      "For every file or module, contributor distribution, recency, and complexity are combined into a single reproducible 0–100 knowledge-concentration risk score.",
  },
  {
    title: "Visualise on the heatmap",
    body:
      "Scores are rendered on an interactive repository heatmap. Selecting any component shows the contributors and factors behind its score.",
  },
  {
    title: "Track history & raise alerts",
    body:
      "Scores are stored over time, so trends are visible. If a component crosses a configured risk threshold, the team is alerted.",
  },
  {
    title: "Recommend pairing",
    body:
      "For the highest-risk components, SiloSense suggests pairing activities intended to spread working knowledge beyond a single contributor.",
  },
];

export default function HowItWorksPage() {
  return (
    <div>
      <section className="border-b border-border bg-muted">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-accent">
            How it works
          </span>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            From raw Git history to a recommendation
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            SiloSense follows a straightforward pipeline. Nothing here
            replaces human judgement — it only makes concentration risk
            visible earlier.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <ol className="relative flex flex-col gap-10 border-l border-border pl-8">
          {steps.map((step, i) => (
            <li key={step.title} className="relative">
              <span className="absolute -left-[41px] flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-brand-primary text-xs font-semibold text-white">
                {i + 1}
              </span>
              <h2 className="text-lg font-semibold text-foreground">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 sm:flex-row sm:items-center">
          <h2 className="text-xl font-semibold text-foreground">
            See the risk score formula in detail
          </h2>
          <Link
            href="/methodology"
            className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark"
          >
            Read the methodology
          </Link>
        </div>
      </section>
    </div>
  );
}
