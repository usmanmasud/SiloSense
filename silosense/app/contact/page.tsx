import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch about the SiloSense final year project.",
};

const details = [
  { label: "Email", value: "hello@silosense.app" },
  { label: "GitHub", value: "github.com/silosense" },
  { label: "Status", value: "Final year project — in development" },
];

export default function ContactPage() {
  return (
    <div>
      <section className="border-b border-border bg-muted">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-accent">
            Contact
          </span>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Questions about the project?
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Whether it&apos;s about the methodology, the evaluation, or
            collaborating on the research, feel free to reach out.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px]">
          <ContactForm />

          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-muted p-6">
              <h3 className="text-sm font-semibold text-foreground">
                Details
              </h3>
              <dl className="mt-4 flex flex-col gap-4">
                {details.map((d) => (
                  <div key={d.label}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {d.label}
                    </dt>
                    <dd className="mt-1 text-sm text-foreground">
                      {d.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
