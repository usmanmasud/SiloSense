import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminTabs } from "@/components/admin-tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/app/repositories");

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <span className="text-xs font-medium uppercase tracking-wide text-brand-accent">
        Admin
      </span>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Operations dashboard
      </h1>

      <AdminTabs />

      <div className="mt-8">{children}</div>
    </div>
  );
}
