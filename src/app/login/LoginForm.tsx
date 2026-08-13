"use client";

// src/app/login/LoginForm.tsx
// Email + password sign-in. Calls the signInWithPassword server action.
// On success, navigates to the post-login redirect (onboarding or ?next=).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { signInWithPassword } from "@/lib/supabase/actions";

interface LoginFormProps {
  next: string;
  initialError?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "The confirmation link looks incomplete. Please request a new one.",
  exchange_failed: "We couldn't sign you in. Please try again.",
  session_expired: "Your session expired. Please sign in again.",
};

export function LoginForm({ next, initialError }: LoginFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(
    initialError ? ERROR_MESSAGES[initialError] ?? "Something went wrong." : null,
  );

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await signInWithPassword(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      // Redirect to the protected page (or onboarding) via a hard nav so
      // server components re-fetch with the new session cookie.
      window.location.href = res.redirectTo || next;
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Email address
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 w-full rounded-md border border-border bg-bg pl-10 pr-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Password
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Your password"
            className="h-11 w-full rounded-md border border-border bg-bg pl-10 pr-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>

      <input type="hidden" name="next" value={next} />

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-sale/30 bg-sale/5 px-3 py-2 text-sm text-sale">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <ArrowRight size={16} />
          </>
        )}
      </button>

      <p className="text-center text-sm text-text-muted">
        New here?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-accent hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
