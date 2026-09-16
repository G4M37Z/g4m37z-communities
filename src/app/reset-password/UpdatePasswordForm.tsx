"use client";

// src/app/reset-password/UpdatePasswordForm.tsx
// New-password form shown after a recovery link. Requires an authenticated
// session (established by /auth/callback when it exchanged the recovery code).

import { useState, useTransition } from "react";
import {
  Lock,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { updatePassword } from "@/lib/supabase/actions";

export function UpdatePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updatePassword(formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.ok) {
        window.location.href = res.redirectTo;
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          New password
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
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="h-11 w-full rounded-md border border-border bg-bg pl-10 pr-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          At least 8 characters. Use a mix of letters and numbers.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Confirm new password
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Repeat your new password"
            className="h-11 w-full rounded-md border border-border bg-bg pl-10 pr-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>

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
            Updating password…
          </>
        ) : (
          <>
            Update password
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </form>
  );
}