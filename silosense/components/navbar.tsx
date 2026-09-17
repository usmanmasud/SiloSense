"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./logo";

const links = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/methodology", label: "Methodology" },
  { href: "/dashboard", label: "Preview" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-brand-primary ${
                pathname === link.href
                  ? "text-brand-primary"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/app/login"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-brand-primary"
          >
            Log in
          </Link>
          <Link
            href="/app/register"
            className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accent-dark"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M3 3 L15 15 M15 3 L3 15"
                stroke="var(--brand-primary)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M2 5 H16 M2 9 H16 M2 13 H16"
                stroke="var(--brand-primary)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-4">
            {[...links, { href: "/contact", label: "Contact" }].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`text-sm font-medium ${
                    pathname === link.href
                      ? "text-brand-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="flex gap-3 pt-2">
              <Link
                href="/app/login"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground"
              >
                Log in
              </Link>
              <Link
                href="/app/register"
                onClick={() => setOpen(false)}
                className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-white"
              >
                Get started
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
