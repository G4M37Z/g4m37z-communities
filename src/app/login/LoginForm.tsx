"use client";

// src/app/login/LoginForm.tsx
// Email + password sign-in with a Google OAuth option beneath a clear OR
// divider. Calls the Supabase server actions; navigates on success.

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { signInWithPassword, signInWithGoogle } from "@/lib/supabase/actions";

interface LoginFormProps {
  next: string;
  initialError?: string;
  initialSuccess?: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_code:
    "The confirmation link looks incomplete. Please request a new one.",
  exchange_failed: "We couldn't sign you in. Please try again.",
  session_expired: "Your session expired. Please sign in again.",
  link_expired:
    "That link has expired or is no longer valid. Please request a new one.",
  reset_required:
    "Your password-reset session is missing or expired. Please request a new reset link.",
  oauth_failed: "Sign-in with Google didn't complete. Please try again.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

export function LoginForm({ next, initialError, initialSuccess }: LoginFormProps) {
  const [pending, startTransition] = useTransition();
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError ? ERROR_MESSAGES[initialError] ?? "Something went wrong." : null,
  );
  const [success, setSuccess] = useState<string | null>(initialSuccess ?? null);

  function onSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await signInWithPassword(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      // Redirect to the protected page via a hard nav so server components
      // re-fetch with the new session cookie.
      window.location.href = res.redirectTo || next;
    });
  }

  async function onGoogle() {
    setError(null);
    setSuccess(null);
    setGooglePending(true);
    try {
      const res = await signInWithGoogle(next);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.ok && res.url) {
        window.location.href = res.url;
      }
    } finally {
      setGooglePending(false);
    }
  }

  return (
    <>
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
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-fg"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-text-muted transition-colors hover:text-accent-text"
            >
              Forgot password?
            </Link>
          </div>
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
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-sale/30 bg-sale/5 px-3 py-2 text-sm text-sale"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <p>{success}</p>
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
      </form>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-widest text-text-muted">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={onGoogle}
        disabled={googlePending}
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border border-border bg-bg px-4 text-sm font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
      >
        {googlePending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-text-muted">
        New here?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-accent-text hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}