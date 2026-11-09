import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Repository mining, risk scoring, heatmap visualisation, alerts, pairing recommendations, and machine-learning refinement.",
};

const features = [
  {
    number: "01",
    title: "Repository mining",
    body:
      "SiloSense clones a public GitHub repository with the Git command-line tool and reads up to its latest 2,000 commits: who changed each file, when, and how many lines were added and deleted. This forms the raw evidence behind every risk score.",
    points: [
      "Commit authorship and timestamps",
      "Lines added and deleted per file",
      "File sizes at the latest commit",
    ],
  },
  {
    number: "02",
    title: "Component-level risk score",
    body:
      "Each file or module is scored from 0–100 using three signals: how concentrated its contributor base is, how recent those contributions are, and how complex the component is. The formula is documented in full on the methodology page.",
    points: [
      "Contributor distribution / contribution share",
      "Recency of contribution",
      "Complexity-related weighting",
    ],
  },
  {
    number: "03",
    title: "Interactive heatmap",
    body:
      "A repository-wide view renders every scored component as a coloured cell. Selecting a cell drills down into the contributors, the recency of their activity, and the factors that produced the score.",
    points: [
      "Colour-coded by risk level",
      "Drill-down per file or module",
      "Contributor breakdown on demand",
    ],
  },
  {
    number: "04",
    title: "History and threshold alerts",
    body:
      "Risk scores are recorded over time so a team can see whether a component's risk is rising or falling. When a score crosses the threshold of 70, SiloSense raises an alert.",
    points: [
      "Historical score timeline per component",
      "Alert threshold of 70",
      "Alerts only when a file crosses the threshold",
    ],
  },
  {
    number: "05",
    title: "Pairing recommendations",
    body:
      "For components at medium risk or above, SiloSense suggests which developers could be paired together — typically the main contributor and the second contributor — or recommends documentation, to spread working knowledge.",
    points: [
      "Owner / secondary-contributor matching",
      "Prioritised by risk severity",
      "Intended as a starting point, not a mandate",
    ],
  },
  {
    number: "06",
    title: "Machine-learning refinement",
    body:
      "As an extension of the rule-based score, a logistic-regression model is trained on a repository's own history to predict which files will be high-risk at the next checkpoint, and is compared with a simple baseline.",
    points: [
      "Trained on repository-derived features",
      "Evaluated against a baseline rule",
      "Optional layer, not a replacement",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div>
      <section className="border-b border-border bg-muted">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-accent">
            Features
          </span>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Six features, working together as one system
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Every feature below is part of one workflow — from mining raw
            Git data to producing a recommendation a team can act on.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col divide-y divide-border">
          {features.map((f) => (
            <div
              key={f.number}
              className="grid gap-6 py-10 first:pt-0 last:pb-0 md:grid-cols-[100px_1fr]"
            >
              <span className="text-3xl font-semibold text-border">
                {f.number}
              </span>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {f.title}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {f.body}
                </p>
                <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
                  {f.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 sm:flex-row sm:items-center">
          <h2 className="text-xl font-semibold text-foreground">
            Curious how the pieces fit together?
          </h2>
          <Link
            href="/how-it-works"
            className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark"
          >
            See how it works
          </Link>
        </div>
      </section>
    </div>
  );
}
