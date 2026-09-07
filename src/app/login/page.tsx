// src/app/login/page.tsx — full-screen mobile-first login, responsive layout
import Link from "next/link";
import { Lock } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
  description: "Sign in to G4M37Z Communities.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="container-x flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
            <Lock size={26} />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-fg sm:text-3xl">Sign in to G4M37Z</h1>
          <p className="text-sm text-text-secondary">Enter your email and password to access your account.</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
          <LoginForm next={next ?? "/"} initialError={error} />
        </div>

        <p className="mt-6 text-center text-sm text-text-secondary">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="font-medium text-accent hover:underline">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="font-medium text-accent hover:underline">Privacy Policy</Link>
          .
        </p>
      </div>
    </main>
  );
}