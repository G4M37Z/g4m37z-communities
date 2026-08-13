// src/app/login/page.tsx
// Email + password sign-in. Server Component shell that renders the form
// (a client component for the in-flight state).

import Link from "next/link";
import { Lock } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
  description: "Sign in to G4M37Z Communities with your email and password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="container-x flex min-h-[80vh] items-center justify-center py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
            <Lock size={26} />
          </div>
          <h1 className="mb-2 text-2xl font-black text-fg sm:text-3xl">
            Sign in to G4M37Z
          </h1>
          <p className="text-sm text-text-muted">
            Enter your email and password to access your account.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-bg p-6 sm:p-8">
          <LoginForm next={next ?? "/"} initialError={error} />
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-fg">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-fg">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
