// ============================================================================
// src/lib/supabase/actions.ts
// Server Actions for G4M37Z Communities authentication.
// Uses @supabase/ssr with the request-bound cookie session.
// ============================================================================

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  authCallbackUrl,
  authErrorMessage,
  sanitizeNextPath,
} from "@/lib/supabase/auth-urls";

// ---------------------------------------------------------------------------
// Username validation
// ---------------------------------------------------------------------------

function validateUsername(username: string): string | null {
  const u = username.trim();
  if (u.length < 3) return "Username must be at least 3 characters.";
  if (u.length > 30) return "Username must be 30 characters or fewer.";
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    return "Username may only contain letters, numbers, and underscores.";
  }
  if (/^_|_$/.test(u)) {
    return "Username cannot start or end with an underscore.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// signUpWithPassword
// Creates a new user with email + password. Creates a matching profile row.
// ---------------------------------------------------------------------------

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const next = String(formData.get("next") ?? "/");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
    }
    const usernameError = validateUsername(username);
    if (usernameError) return { error: usernameError };
    if (displayName.length === 0) {
    return { error: "Please enter a display name." };
    }
    if (displayName.length > 80) {
    return { error: "Display name must be 80 characters or fewer." };
    }

    // Terms acceptance guard (UI also requires the checkbox, but server
    // double-checks so a forged request can never bypass it).
    const accepted = formData.get("acceptTerms");
    const termsVersion = String(formData.get("termsVersion") ?? "");
    if (accepted !== "true" || termsVersion.length === 0) {
    return { error: "You must accept the Terms of Service to create an account." };
    }

  const supabase = await createClient();
  const callbackUrl = authCallbackUrl(next);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl,
      data: {
        username,
        display_name: displayName,
        terms_version: termsVersion,
        terms_accepted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    console.error("signUpWithPassword failed:", error);
    return {
      error: authErrorMessage(
        error,
        "We couldn't create your account. Please try again.",
      ),
    };
  }

  // Supabase returns identities=[] for already-registered emails (without leaking).
  if (data?.user && data.user.identities && data.user.identities.length === 0) {
    return {
      error: "An account with this email already exists. Try signing in.",
    };
  }

  // NOTE on profile creation:
  // When email confirmation is enabled (Supabase default), the user is NOT
  // authenticated immediately after signUp — auth.uid() is null. Inserting
  // into profiles here would fail the RLS WITH CHECK (auth.uid() = id).
  // We pass username + display_name through user_metadata and let
  // /auth/callback create the profile once the user is authenticated.
  // See src/app/auth/callback/route.ts.

  return { ok: true, email };
}

// ---------------------------------------------------------------------------
// checkUsernameAvailability
// Used by the signup form to validate a username live as the user types.
// Returns { available: boolean } — never throws.
// ---------------------------------------------------------------------------

export async function checkUsernameAvailability(username: string) {
  const validationError = validateUsername(username);
  if (validationError) {
    return { available: false, reason: validationError, code: "invalid" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", username.trim())
    .maybeSingle();

  if (error) {
    console.error("checkUsernameAvailability failed:", error);
    // Fail open — let the DB unique constraint catch real duplicates.
    return { available: true, reason: null, code: "unchecked" };
  }
  if (data) {
    return { available: false, reason: "That username is already taken.", code: "taken" };
  }
  return { available: true, reason: null, code: "available" };
}

// ---------------------------------------------------------------------------
// signInWithPassword
// Signs in an existing user. Returns redirect target on success.
// ---------------------------------------------------------------------------

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Sanitize on the server: never let a forged `next` become a redirect target.
  const next = sanitizeNextPath(String(formData.get("next") ?? "/"), "/");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }
  if (password.length === 0) {
    return { error: "Please enter your password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("signInWithPassword failed:", error);
    return {
      error: authErrorMessage(
        error,
        "We couldn't sign you in. Please try again.",
      ),
    };
  }

  return { ok: true, redirectTo: next };
}

// ---------------------------------------------------------------------------
// signOut
// Clears the session cookie and bounces to /.
// ---------------------------------------------------------------------------

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------------------------------------------------------------------------
// signInWithGoogle
// Starts the Google OAuth flow. Supabase redirects to Google, then back to
// /auth/callback with a PKCE code that the callback exchanges for a session.
// ---------------------------------------------------------------------------

export async function signInWithGoogle(next = "/") {
  const safeNext = sanitizeNextPath(next, "/");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackUrl(safeNext),
    },
  });

  if (error) {
    console.error("signInWithGoogle failed:", error);
    return {
      error: authErrorMessage(
        error,
        "Sign-in with Google didn't start. Please try again.",
      ),
    };
  }

  if (!data?.url) {
    return {
      error: "Sign-in with Google didn't start. Please try again.",
    };
  }

  return { ok: true, url: data.url };
}

// ---------------------------------------------------------------------------
// requestPasswordReset
// Sends the "forgot password" email. The email link points at /auth/callback
// (single exchange point — no competing reset architecture). Once the session
// is established, the callback routes the user to /reset-password.
// ---------------------------------------------------------------------------

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl(next),
  });

  if (error) {
    console.error("requestPasswordReset failed:", error);
    return {
      error: authErrorMessage(
        error,
        "We couldn't send a reset link. Please try again.",
      ),
    };
  }

  return { ok: true, email };
}

// ---------------------------------------------------------------------------
// updatePassword
// Sets a new password for a user who arrived via a password-reset link.
// Requires an authenticated session (established by /auth/callback when it
// exchanged the recovery code). Signs the user out afterwards so they sign in
// again with the new password.
// ---------------------------------------------------------------------------

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error:
        "Your reset link has expired or already been used. Please request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("updatePassword failed:", error);
    return {
      error: authErrorMessage(
        error,
        "We couldn't update your password. Please try again.",
      ),
    };
  }

  // Sign out on success so the user signs in with the new password, and the
  // old session cannot be replayed.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { ok: true, redirectTo: "/login?reset=complete" };
}

// ---------------------------------------------------------------------------
// updateProfile
// Updates the authenticated user's profile (display_name, bio, avatar_url).
// RLS policy ensures users can only update their own row.
// ---------------------------------------------------------------------------

export async function updateProfile(input: {
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  // Validate display_name length
  if (input.display_name && input.display_name.length > 80) {
    return { error: "Display name must be 80 characters or fewer." };
  }

  // Validate bio length
  if (input.bio && input.bio.length > 500) {
    return { error: "Bio must be 500 characters or fewer." };
  }

  // Validate avatar_url is a valid URL if provided
  if (input.avatar_url) {
    try {
      new URL(input.avatar_url);
    } catch {
    return { error: "Avatar URL must be a valid URL." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.display_name,
      bio: input.bio,
      avatar_url: input.avatar_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("updateProfile failed:", error);
    return { error: "Couldn't update profile. Please try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/profile/[username]", "page");
  return { ok: true };
}

