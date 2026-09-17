import Link from "next/link";
import { RiskGrid } from "@/components/risk-grid";

const problems = [
  {
    stat: "1–2",
    label: "developers",
    body:
      "often hold the working knowledge of a critical module, formed simply by who happened to touch it most.",
  },
  {
    stat: "0",
    label: "visibility",
    body:
      "into that concentration today — most teams only discover it once a key contributor leaves or goes on leave.",
  },
  {
    stat: "100%",
    label: "repository-derived",
    body:
      "evidence is already sitting in your Git history: commits, blame data, and review activity.",
  },
];

const features = [
  {
    title: "Repository mining",
    body: "Pulls commit, blame, and pull-request/review metadata from Git-based repositories via the GitHub/GitLab APIs.",
  },
  {
    title: "0–100 risk score",
    body: "Combines contributor distribution, recency of contribution, and complexity into one reproducible component-level score.",
  },
  {
    title: "Interactive heatmap",
    body: "A drill-down repository view that shows which files are at risk and which developers are behind each score.",
  },
  {
    title: "History & alerts",
    body: "Tracks how risk moves over time and notifies the team when a component crosses a defined threshold.",
  },
  {
    title: "Pairing recommendations",
    body: "Suggests pairing and knowledge-sharing activities aimed at reducing dependence on a single contributor.",
  },
  {
    title: "ML-assisted scoring",
    body: "An optional lightweight model investigated as a refinement of the baseline scoring formula.",
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-border bg-muted">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
          <div>
            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              Final year project · Software Engineering
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              See who really knows
              <span className="text-brand-primary"> your codebase.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-7 text-muted-foreground">
              SiloSense mines Git repository history to reveal where
              knowledge is concentrated among too few developers — before a
              key contributor leaves and takes that knowledge with them.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="rounded-full bg-brand-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-dark"
              >
                Explore the dashboard
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:border-brand-primary hover:text-brand-primary"
              >
                How it works
              </Link>
            </div>
          </div>

          <RiskGrid />
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Knowledge silos build up quietly
          </h2>
          <p className="mt-3 text-muted-foreground">
            Research on code ownership and Truck Factor shows that software
            knowledge is rarely spread evenly — SiloSense turns that research
            into a system teams can act on.
          </p>
        </div>
        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {problems.map((p) => (
            <div key={p.label} className="border-t-2 border-brand-primary pt-4">
              <div className="text-3xl font-semibold text-brand-primary">
                {p.stat}
              </div>
              <div className="text-sm font-medium text-foreground">
                {p.label}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border bg-muted">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              What SiloSense does
            </h2>
            <p className="mt-3 text-muted-foreground">
              Six objectives, one workflow — from raw commit data to a
              recommendation your team can act on.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-background p-6"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10">
            <Link
              href="/features"
              className="text-sm font-semibold text-brand-primary hover:text-brand-primary-dark"
            >
              See all features →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-brand-primary px-8 py-12 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Read the methodology behind the risk score
            </h2>
            <p className="mt-2 max-w-lg text-sm text-white/80">
              Understand exactly how contributor distribution, recency, and
              complexity combine into a single 0–100 score.
            </p>
          </div>
          <Link
            href="/methodology"
            className="shrink-0 rounded-full bg-brand-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-dark"
          >
            View methodology
          </Link>
        </div>
      </section>
    </div>
  );
}
