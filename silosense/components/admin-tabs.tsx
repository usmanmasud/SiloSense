"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/app/admin", label: "Overview" },
  { href: "/app/admin/users", label: "Users" },
  { href: "/app/admin/system", label: "System" },
  { href: "/app/admin/billing", label: "Billing" },
  { href: "/app/admin/repositories", label: "Repositories" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex flex-wrap gap-1 border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-brand-accent text-brand-primary"
                : "border-transparent text-muted-foreground hover:text-brand-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
