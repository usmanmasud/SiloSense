import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/app/repositories");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted px-6 py-16">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}
