"use client";

// src/app/settings/SettingsForm.tsx
// Profile edit form — display_name, bio, avatar_url (URL input for now).
// Calls a server action to update the profile (RLS enforces ownership).

import { useState, useTransition } from "react";
import { User, Loader2, Check } from "lucide-react";
import { updateProfile } from "@/lib/supabase/actions";

interface SettingsFormProps {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    created_at: string;
  };
}

export function SettingsForm({ profile }: SettingsFormProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await updateProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Profile updated." });
      }
    });
  }

  return (
    <main className="container-x py-12 max-w-xl">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-fg">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage your profile and preferences.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Username (read-only) */}
        <section className="rounded-2xl border border-border bg-bg p-6">
          <h2 className="mb-4 text-base font-semibold text-fg">Username</h2>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-fg">@{profile.username}</p>
              <p className="text-xs text-text-muted">Username cannot be changed.</p>
            </div>
          </div>
        </section>

        {/* Display name */}
        <section className="rounded-2xl border border-border bg-bg p-6">
          <h2 className="mb-4 text-base font-semibold text-fg">Display name</h2>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder="How you want to appear"
              className="h-11 w-full rounded-md border border-border bg-bg pl-10 pr-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <p className="mt-1 text-xs text-text-muted">Visible on your posts, comments, and profile.</p>
        </section>

        {/* Bio */}
        <section className="rounded-2xl border border-border bg-bg p-6">
          <h2 className="mb-4 text-base font-semibold text-fg">Bio</h2>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Tell people about yourself"
            className="w-full rounded-md border border-border bg-bg p-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
          />
          <p className="mt-1 text-xs text-text-muted">
            {bio.length}/500
          </p>
        </section>

        {/* Avatar URL */}
        <section className="rounded-2xl border border-border bg-bg p-6">
          <h2 className="mb-4 text-base font-semibold text-fg">Avatar URL</h2>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className="h-11 w-full rounded-md border border-border bg-bg pl-10 pr-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <p className="mt-1 text-xs text-text-muted">
            Direct link to an image (PNG, JPG, WebP). We do not host uploads yet.
          </p>
          {avatarUrl && (
            <div className="mt-3 flex items-center gap-3">
              <img
                src={avatarUrl}
                alt="Current avatar preview"
                className="h-12 w-12 rounded-full object-cover border border-border"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="text-sm text-text-muted">Preview</span>
            </div>
          )}
        </section>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              message.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-sale/30 bg-sale/10 text-sale"
            }`}
          >
            {message.type === "success" ? <Check size={16} /> : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {message.text}
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
              Saving…
            </>
          ) : (
            <>
              Save changes
              <Check size={16} />
            </>
          )}
        </button>
      </form>
    </main>
  );
}
