"use client";

// src/app/settings/SettingsForm.tsx
// Profile edit form — display_name, bio, avatar (real file upload).
// Calls server actions to update the profile (RLS enforces ownership).

import { useRef, useState, useTransition } from "react";
import { User, Loader2, Check, Upload, Trash2, ImageIcon } from "lucide-react";
import { updateProfile } from "@/lib/supabase/actions";
import {
  uploadAvatar,
  removeAvatar,
} from "@/lib/supabase/avatar-actions";

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
  const [avatarPending, startAvatarTransition] = useTransition();
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);
  const [avatarMessage, setAvatarMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  // Local state mirrors the saved profile so the form feels responsive.
  // Updated by the result of updateProfile on success.
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await updateProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        // avatar_url is no longer edited in this form — it's handled by the
        // uploadAvatar action which writes to storage + profile. Keep the
        // existing value so updateProfile doesn't clear it.
        avatar_url: avatarUrl || null,
      });
      if (res.error) {
        setMessage({ type: "error", text: res.error });
      } else {
        setMessage({ type: "success", text: "Profile updated." });
      }
    });
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMessage(null);

    if (file.size === 0) {
      setAvatarMessage({ type: "error", text: "File is empty." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMessage({ type: "error", text: "Avatar must be 5 MB or smaller." });
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setAvatarMessage({
        type: "error",
        text: "Avatar must be JPEG, PNG, WebP, or GIF.",
      });
      return;
    }

    const fd = new FormData();
    fd.append("avatar", file);

    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);

    startAvatarTransition(async () => {
      const res = await uploadAvatar(fd);
      if (res.error) {
        setAvatarMessage({ type: "error", text: res.error });
        setAvatarUrl(profile.avatar_url ?? "");
        return;
      }
      if (res.url) setAvatarUrl(res.url);
      setAvatarMessage({ type: "success", text: "Avatar updated." });
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (res.url) URL.revokeObjectURL(previewUrl);
    });
  }

  function onRemoveAvatar() {
    setAvatarMessage(null);
    startAvatarTransition(async () => {
      const res = await removeAvatar();
      if (res.error) {
        setAvatarMessage({ type: "error", text: res.error });
        return;
      }
      setAvatarUrl("");
      setAvatarMessage({ type: "success", text: "Avatar removed." });
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

      {/* Avatar */}
      <section className="mb-6 rounded-2xl border border-border bg-bg p-6">
        <h2 className="mb-4 text-base font-semibold text-fg">Profile picture</h2>
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-surface">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="Profile preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent/10 text-accent">
                <ImageIcon size={28} aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                id="avatarFile"
                name="avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={onAvatarChange}
                disabled={avatarPending}
                aria-label="Upload avatar image"
                className="sr-only"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarPending}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {avatarPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                Upload new
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={onRemoveAvatar}
                  disabled={avatarPending}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg px-3 text-sm font-medium text-text-muted transition-colors hover:border-sale hover:text-sale disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-text-muted">
              JPEG, PNG, WebP, or GIF. Max 5 MB. Stored securely in your folder
              on Supabase Storage.
            </p>
            {avatarMessage && (
              <p
                className={`text-xs ${
                  avatarMessage.type === "success" ? "text-success" : "text-sale"
                }`}
              >
                {avatarMessage.text}
              </p>
            )}
          </div>
        </div>
      </section>

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
          <p className="mt-1 text-xs text-text-muted">{bio.length}/500</p>
        </section>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              message.type === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-sale/30 bg-sale/10 text-sale"
            }`}
          >
            {message.type === "success" ? (
              <Check size={16} />
            ) : (
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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