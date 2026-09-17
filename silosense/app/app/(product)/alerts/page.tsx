import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getAlertsForUser } from "@/lib/queries";
import { formatRelativeTime } from "@/lib/format";
import { AckAlertButton } from "@/components/ack-alert-button";

export const metadata: Metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const user = await getCurrentUser();
  const alerts = await getAlertsForUser(user!.id);
  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Alerts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fired whenever a component crosses the risk threshold across any of
        your analyzed repositories.
      </p>

      {alerts.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No alerts yet — they&apos;ll show up here once a file crosses the
            risk threshold.
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
          {[...unacknowledged, ...alerts.filter((a) => a.acknowledged)].map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <Link
                  href={`/app/repositories/${a.repository_id}/components/${a.component_id}`}
                  className="truncate font-mono text-sm text-foreground hover:text-brand-primary"
                >
                  {a.repository_owner}/{a.repository_name} · {a.component_path}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.previous_score !== null ? `${Math.round(a.previous_score)} → ` : ""}
                  {Math.round(a.new_score)} · crossed {a.threshold} · {formatRelativeTime(a.created_at)}
                </p>
              </div>
              {a.acknowledged ? (
                <span className="shrink-0 text-xs text-muted-foreground">Acknowledged</span>
              ) : (
                <AckAlertButton alertId={a.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
