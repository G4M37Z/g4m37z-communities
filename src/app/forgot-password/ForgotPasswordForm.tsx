"use client";

// src/app/forgot-password/ForgotPasswordForm.tsx
// Email-only form that triggers the Supabase "reset password" email.
// On success shows clear next steps (inbox, spam, link expiry, back to login).

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Mail,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { requestPasswordReset } from "@/lib/supabase/actions";

interface ForgotPasswordFormProps {
  next: string;
}

export function ForgotPasswordForm({ next }: ForgotPasswordFormProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await requestPasswordReset(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.ok) {
        setSentTo(res.email);
      }
    });
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-4 text-success" size={48} />
        <h2 className="mb-2 text-lg font-bold text-fg">Check your inbox</h2>
        <p className="mb-1 text-sm text-text-muted">
          We sent a password reset link to:
        </p>
        <p className="mb-4 font-mono text-sm text-fg">{sentTo}</p>
        <p className="text-xs leading-relaxed text-text-muted">
          Open the link to choose a new password. If you don&apos;t see it
          within a few minutes, check your spam or junk folder. The link
          expires after a short time — safe to request a fresh one.
        </p>
        <p className="mt-4 text-xs text-text-muted">
          Remembered your password?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="text-xs font-medium text-accent-text hover:underline"
          >
            Return to sign in
          </Link>
        </p>
      </div>
    );
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

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending reset link…
          </>
        ) : (
          <>
            Send reset link
            <ArrowRight size={16} />
          </>
        )}
      </button>

      <p className="text-center text-sm text-text-muted">
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-accent-text hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}