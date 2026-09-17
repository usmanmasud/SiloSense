import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "A preview of the SiloSense repository heatmap, component detail panel, and alert feed.",
};

const sidebarItems = [
  { label: "Repositories", active: false },
  { label: "Heatmap", active: true },
  { label: "Alerts", active: false },
  { label: "Recommendations", active: false },
  { label: "Settings", active: false },
];

// 0 = low, 1 = medium, 2 = elevated, 3 = high
const grid = [
  0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 1, 0, 3, 0, 1, 0, 1, 0, 2, 1, 0, 0, 2, 0, 0, 1,
  0, 3, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0, 0, 3, 1, 0, 0, 2, 0, 1,
];

const cellClass: Record<number, string> = {
  0: "bg-muted border border-border",
  1: "bg-brand-primary/25",
  2: "bg-brand-accent/50",
  3: "bg-brand-accent ring-2 ring-brand-accent-dark ring-offset-2 ring-offset-background",
};

const contributors = [
  { initials: "AM", name: "A. Musa", share: 68 },
  { initials: "TB", name: "T. Bello", share: 22 },
  { initials: "KI", name: "K. Ibrahim", share: 10 },
];

const alerts = [
  {
    component: "payments/settlement.ts",
    change: "+14",
    date: "2 days ago",
    status: "New alert",
  },
  {
    component: "auth/session-manager.ts",
    change: "+6",
    date: "5 days ago",
    status: "Rising",
  },
  {
    component: "core/scheduler.ts",
    change: "−9",
    date: "1 week ago",
    status: "Improving",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <section className="border-b border-border bg-muted">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-accent">
            Dashboard preview
          </span>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            The repository heatmap, at a glance
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            A static preview of the SiloSense interface — the heatmap,
            component detail panel, and alert feed a team would see for a
            connected repository.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
          <div className="flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto bg-brand-primary p-3 text-white md:w-56 md:flex-col md:gap-1 md:p-4">
              <div className="hidden px-2 pb-4 text-sm font-semibold tracking-tight md:block">
                SiloSense
              </div>
              {sidebarItems.map((item) => (
                <div
                  key={item.label}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                    item.active
                      ? "bg-white/15 text-white"
                      : "text-white/65"
                  }`}
                >
                  {item.label}
                </div>
              ))}
            </aside>

            {/* Main */}
            <div className="flex-1 bg-background">
              {/* Top bar */}
              <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                  <span className="h-2 w-2 rounded-full bg-brand-accent" />
                  acme/payments-service
                </div>
                <span className="text-xs text-muted-foreground">
                  Last synced 2 hours ago
                </span>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
                {/* Heatmap */}
                <div>
                  <div className="grid grid-cols-8 gap-2 sm:grid-cols-12">
                    {grid.map((level, i) => (
                      <div
                        key={i}
                        className={`aspect-square rounded-md ${cellClass[level]}`}
                      />
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-muted border border-border" />
                      low
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-brand-primary/25" />
                      medium
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-brand-accent/50" />
                      elevated
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-brand-accent" />
                      high
                    </span>
                  </div>
                </div>

                {/* Detail panel */}
                <div className="rounded-xl border border-border bg-muted p-5">
                  <span className="font-mono text-xs text-muted-foreground">
                    payments/settlement.ts
                  </span>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl font-semibold text-brand-accent">
                      82
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      / 100 · high risk
                    </span>
                  </div>

                  <div className="mt-5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Contributors
                    </span>
                    <div className="mt-3 flex flex-col gap-3">
                      {contributors.map((c) => (
                        <div key={c.initials} className="flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[10px] font-semibold text-white">
                            {c.initials}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-foreground">{c.name}</span>
                              <span className="text-muted-foreground">
                                {c.share}%
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-border">
                              <div
                                className="h-1.5 rounded-full bg-brand-accent"
                                style={{ width: `${c.share}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-lg border border-border bg-background p-3">
                    <span className="text-xs font-semibold text-foreground">
                      Recommended pairing
                    </span>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Pair A. Musa with K. Ibrahim on the next change to
                      spread ownership.
                    </p>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              <div className="border-t border-border px-6 py-6">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent alerts
                </span>
                <div className="mt-3 flex flex-col divide-y divide-border">
                  {alerts.map((a) => (
                    <div
                      key={a.component}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <span className="font-mono text-xs text-foreground sm:text-sm">
                        {a.component}
                      </span>
                      <span
                        className={`hidden sm:inline text-xs font-medium ${
                          a.change.startsWith("+")
                            ? "text-brand-accent"
                            : "text-muted-foreground"
                        }`}
                      >
                        {a.change}
                      </span>
                      <span className="hidden text-xs text-muted-foreground md:inline">
                        {a.date}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-muted p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-foreground">
              This page is a static visual preview.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a free account to analyse a real public GitHub
              repository and see live scores.
            </p>
          </div>
          <Link
            href="/app/register"
            className="shrink-0 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-accent-dark"
          >
            Analyze a real repo
          </Link>
        </div>
      </section>
    </div>
  );
}
