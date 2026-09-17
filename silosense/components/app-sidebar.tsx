"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const items = [
  { href: "/app/repositories", label: "Repositories" },
  { href: "/app/alerts", label: "Alerts" },
  { href: "/app/account", label: "Account" },
];

export function AppSidebar({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="flex w-full shrink-0 flex-col justify-between bg-brand-primary text-white md:h-screen md:w-60 md:sticky md:top-0">
      <div>
        <div className="flex items-center gap-2 px-5 py-5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="5" r="3" fill="white" />
            <circle cx="5" cy="18" r="3" fill="white" fillOpacity="0.6" />
            <circle cx="19" cy="18" r="3" fill="var(--brand-accent)" />
            <path
              d="M12 8 L6.2 15.7 M12 8 L17.8 15.7"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-sm font-semibold tracking-tight">SiloSense</span>
        </div>

        <nav className="flex flex-row gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-white/15 text-white" : "text-white/65 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{name}</p>
            <p className="truncate text-[11px] text-white/60">{email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="shrink-0 text-xs font-medium text-white/70 hover:text-white"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
