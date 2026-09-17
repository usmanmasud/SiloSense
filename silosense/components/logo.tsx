import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="5" r="3" fill="var(--brand-primary)" />
        <circle cx="5" cy="18" r="3" fill="var(--brand-primary)" />
        <circle cx="19" cy="18" r="3" fill="var(--brand-accent)" />
        <path
          d="M12 8 L6.2 15.7 M12 8 L17.8 15.7"
          stroke="var(--brand-primary)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight text-brand-primary">
        SiloSense
      </span>
    </Link>
  );
}
