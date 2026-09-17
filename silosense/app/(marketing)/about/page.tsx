import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "The aim, objectives, and scope of SiloSense — a final year project on knowledge-concentration risk detection.",
};

const objectives = [
  "Mine commit, blame, and pull-request/review metadata from Git-based repositories using Git and GitHub/GitLab APIs.",
  "Develop a reproducible component-level knowledge-concentration risk score on a 0–100 scale using contributor distribution, recency, and complexity-related information.",
  "Develop an interactive repository visualisation that presents component risk and allows users to examine the developers and factors behind each result.",
  "Track risk scores over time and provide alerts when a component crosses a defined risk threshold.",
  "Generate pairing and knowledge-sharing recommendations that can help reduce excessive dependence on individual contributors.",
  "Evaluate the system using selected open-source repositories, comparing detected risks with repository history, known contributor changes, and developer assessment.",
];

const inScope = [
  "Git repositories and available GitHub/GitLab commit, blame, pull-request, and review metadata.",
  "Repository-level and component-level analysis of contribution distribution, recency, and complexity.",
  "A defined 0–100 risk score with historical records for observing change over time.",
  "An interactive repository heatmap with drill-down detail on risk and contributors.",
  "Threshold-based alerts for components exceeding a configured risk level.",
  "Pairing and knowledge-sharing recommendations.",
  "Investigation of a lightweight supervised model as a refinement of the baseline score.",
  "Evaluation on roughly 5–10 real open-source repositories.",
];

const outOfScope = [
  "Replacing general software-quality analysis platforms.",
  "Informing employment decisions about individual developers.",
  "Reproducing the full functionality of GitHub or GitLab.",
];

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-border bg-muted">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-accent">
            About the project
          </span>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Making knowledge concentration visible
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            SiloSense is a final year project developed to detect,
            visualise, and monitor areas of a software project where
            knowledge is concentrated among a small number of developers.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-xl font-semibold text-foreground">Aim</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          To develop SiloSense, a knowledge-concentration risk detection
          system that uses software repository data to identify, visualise,
          and monitor areas of a software project where knowledge is
          concentrated among a small number of developers.
        </p>

        <h2 className="mt-14 text-xl font-semibold text-foreground">
          Objectives
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          {objectives.map((o, i) => (
            <li key={o} className="flex gap-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="text-sm leading-6 text-muted-foreground">
                {o}
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mt-14 text-xl font-semibold text-foreground">Scope</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-background p-6">
            <h3 className="text-sm font-semibold text-foreground">
              In scope
            </h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {inScope.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-muted p-6">
            <h3 className="text-sm font-semibold text-foreground">
              Out of scope
            </h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {outOfScope.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <h2 className="mt-14 text-xl font-semibold text-foreground">
          Why it matters
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          SiloSense brings together ideas from repository mining, code
          authorship, developer expertise, Truck Factor analysis, and
          knowledge diffusion within a single workflow — measurement,
          visualisation, monitoring, alerts, and recommendations — so teams
          can address knowledge risk before it becomes a dependency they
          discover the hard way.
        </p>
      </section>
    </div>
  );
}
