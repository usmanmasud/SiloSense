import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/app/login");

  return (
    <div className="flex min-h-screen flex-col bg-muted md:flex-row">
      <AppSidebar name={user.name} email={user.email} isAdmin={user.isAdmin} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
