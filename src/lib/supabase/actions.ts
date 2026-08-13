// ============================================================================
// src/lib/supabase/actions.ts
// Server Actions for G4M37Z Communities authentication.
// Uses @supabase/ssr with the request-bound cookie session.
// ============================================================================

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const rawSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const siteUrl = rawSiteUrl
    .replace(/\/$/, "")
    .replace(/\/.*$/, "");

  const callbackUrl = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl,
      data: {
        username,
        display_name: displayName,
      },
    },
  });

  if (error) {
    console.error("signUpWithPassword failed:", error);
    if (error.message.toLowerCase().includes("already registered")) {
      return {
        error: "An account with this email already exists. Try signing in.",
      };
    }
    return {
      error: error.message || "We couldn't create your account. Please try again.",
    };
  }

  // Supabase returns identities=[] for already-registered emails (without leaking).
  if (data?.user && data.user.identities && data.user.identities.length === 0) {
    return {
      error: "An account with this email already exists. Try signing in.",
    };
  }

  if (data?.user) {
    // Create the profile row for the new user. Use the same cookie-bound
    // client — the user is now authenticated so RLS WITH CHECK (auth.uid() = id)
    // will permit the insert. If email confirmation is enabled, this insert
    // happens on the confirmation callback instead (see /auth/callback).
    const { error: profileError } = await supabase.from("profiles").insert([
      {
        id: data.user.id,
        username,
        display_name: displayName,
        avatar_url: null,
        bio: null,
      },
    ]);

    if (profileError) {
      console.error("Failed to create profile for new user:", profileError);
      if (
        profileError.message.toLowerCase().includes("duplicate") ||
        profileError.code === "23505"
      ) {
        return {
          error:
            "That username is already taken. Please choose a different one.",
        };
      }
      // The auth account exists — return success and let the callback handle
      // any missing profile.
    }
  }

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
    return { available: false, reason: validationError };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("username", username.trim())
    .maybeSingle();

  if (error) {
    console.error("checkUsernameAvailability failed:", error);
    return { available: false, reason: "Couldn't check username. Try again." };
  }
  if (data) {
    return { available: false, reason: "That username is already taken." };
  }
  return { available: true };
}

// ---------------------------------------------------------------------------
// signInWithPassword
// Signs in an existing user. Returns redirect target on success.
// ---------------------------------------------------------------------------

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

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
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error:
          "Please verify your email first — check your inbox for the confirmation link.",
      };
    }
    if (
      error.message.toLowerCase().includes("invalid login") ||
      error.message.toLowerCase().includes("invalid credentials")
    ) {
      return { error: "Wrong email or password." };
    }
    return { error: "We couldn't sign you in. Please try again." };
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
