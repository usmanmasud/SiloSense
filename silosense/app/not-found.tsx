import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-32 text-center">
      <span className="text-sm font-semibold text-brand-accent">404</span>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have
        moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark"
      >
        Back to home
      </Link>
    </div>
  );
}
