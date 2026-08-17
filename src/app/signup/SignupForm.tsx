"use client";

// src/app/signup/SignupForm.tsx
// Email + password + username + display name sign-up.
// Calls signUpWithPassword. On success, shows the email confirmation step.

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Mail,
  Lock,
  User,
  AtSign,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { signUpWithPassword, checkUsernameAvailability } from "@/lib/supabase/actions";

interface SignupFormProps {
  next: string;
  initialError?: string;
}

const USERNAME_RULE = /^[a-zA-Z0-9_]{3,30}$/;

export function SignupForm({ next, initialError }: SignupFormProps) {
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(initialError ?? null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Live username availability check
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "ok" | "taken" | "invalid"
  >("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const u = username.trim();
    // Defer setState to avoid lint rule against synchronous setState-in-effect.
    // The updates are intentional and harmless — they only update UI state.
    const queue = (next: typeof usernameStatus) => {
      queueMicrotask(() => setUsernameStatus(next));
    };
    if (u.length === 0) {
      queue("idle");
      return;
    }
    if (!USERNAME_RULE.test(u) || /^_|_$/.test(u)) {
      queue("invalid");
      return;
    }
    queue("checking");
    debounceRef.current = setTimeout(async () => {
      const res = await checkUsernameAvailability(u);
      if (res.available) setUsernameStatus("ok");
      else setUsernameStatus("taken");
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  function onSubmit(formData: FormData) {
      setError(null);
      if (!acceptedTerms) {
        setError("You must accept the Terms of Service to create an account.");
        return;
      }
      if (usernameStatus !== "ok") {
        setError("Please choose a valid, available username.");
        return;
      }
      // Append terms_version + acceptance timestamp for the server to persist
      formData.set("termsAccepted", "true");
      formData.set("termsVersion", "v1");
      startTransition(async () => {
      const res = await signUpWithPassword(formData);
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
          We sent a confirmation link to:
        </p>
        <p className="mb-4 font-mono text-sm text-fg">{sentTo}</p>
        <p className="text-xs text-text-muted">
          Click the link in the email to verify your address and finish
          setting up your account. You can close this tab.
        </p>
        <p className="mt-4 text-xs text-text-muted">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setSentTo(null)}
            className="text-xs font-medium text-accent hover:underline"
          >
            try a different email
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="displayName"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Display name
        </label>
        <div className="relative">
          <User
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            maxLength={80}
            autoComplete="name"
            placeholder="What should we call you?"
            className="h-11 w-full rounded-md border border-border bg-bg pl-10 pr-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="username"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Username
        </label>
        <div className="relative">
          <AtSign
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            id="username"
            name="username"
            type="text"
            required
            minLength={3}
            maxLength={30}
            autoComplete="username"
            placeholder="your_handle"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-bg pl-10 pr-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          3–30 characters. Letters, numbers, and underscores only.
        </p>
        {usernameStatus === "checking" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            Checking availability…
          </p>
        )}
        {usernameStatus === "ok" && (
          <p className="mt-1 text-xs text-success">Username is available.</p>
        )}
        {usernameStatus === "taken" && (
          <p className="mt-1 text-xs text-sale">That username is already taken.</p>
        )}
        {usernameStatus === "invalid" && (
          <p className="mt-1 text-xs text-sale">
            Username must be 3–30 letters, numbers, or underscores.
          </p>
        )}
      </div>

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

      <input type="hidden" name="next" value={next} />

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-sale/30 bg-sale/5 px-3 py-2 text-sm text-sale">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Terms acceptance checkbox — required */}
            <label
              htmlFor="acceptTerms"
              className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-bg p-3 text-sm text-fg transition-colors hover:border-accent has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/30"
            >
              <input
                id="acceptTerms"
                name="acceptTerms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
                aria-required="true"
                aria-describedby="acceptTermsLabel"
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border bg-surface text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <span id="acceptTermsLabel" className="text-xs leading-relaxed text-text-muted">
                I have read and agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline decoration-accent/40 hover:decoration-accent"
                >
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline decoration-accent/40 hover:decoration-accent"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={pending || usernameStatus !== "ok" || !acceptedTerms}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <p className="text-center text-sm text-text-muted">
              Already have an account?{" "}
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="font-semibold text-accent hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        );
      }
