// src/app/signup/page.tsx
// Email + password sign-up. Server Component shell that renders the form
// (a client component for the in-flight state).

import { UserPlus } from "lucide-react";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create your account",
  description: "Sign up for G4M37Z Communities with your email and password.",
};

export default async function SignupPage({
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
            <UserPlus size={26} />
          </div>
          <h1 className="mb-2 text-2xl font-black text-fg sm:text-3xl">
            Create your G4M37Z account
          </h1>
          <p className="text-sm text-text-muted">
            Sign up in seconds. We&apos;ll send a confirmation link to verify
            your email.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-bg p-6 sm:p-8">
          <SignupForm next={next ?? "/"} initialError={error} />
        </div>
      </div>
    </main>
  );
}
