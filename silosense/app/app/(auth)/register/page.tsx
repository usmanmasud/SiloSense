import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">
        Create your account
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Free — analyze a public GitHub repository in a minute.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/app/login" className="font-medium text-brand-primary">
          Log in
        </Link>
      </p>
    </div>
  );
}
