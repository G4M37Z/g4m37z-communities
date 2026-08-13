"use client";

// src/app/create/CreateCommunityForm.tsx
// Form for creating a community. Validates name + slug, shows live slug
// availability, lets the user pick categories, submits via createCommunity
// server action which redirects to the new community page on success.

import { useState, useTransition, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { createCommunity, checkSlugAvailability } from "@/lib/communities/actions";
import type { CommunityCategory } from "@/types/database";

interface Props {
  categories: CommunityCategory[];
}

const SLUG_RULE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
}

export function CreateCommunityForm({ categories }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "ok" | "taken" | "invalid"
  >("idle");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set()
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-derive slug from name until the user touches the slug field.
  useEffect(() => {
    if (!slugTouched) queueMicrotask(() => setSlug(slugify(name)));
  }, [name, slugTouched]);

  // Live slug availability check.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const s = slug.trim();
    // Defer setState to microtask to satisfy react-hooks/set-state-in-effect.
    const queue = (next: typeof slugStatus) => {
      queueMicrotask(() => setSlugStatus(next));
    };
    if (s.length === 0) {
      queue("idle");
      return;
    }
    if (!SLUG_RULE.test(s)) {
      queue("invalid");
      return;
    }
    queue("checking");
    debounceRef.current = setTimeout(async () => {
      const res = await checkSlugAvailability(s);
      if (res.available) setSlugStatus("ok");
      else setSlugStatus("taken");
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [slug]);

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onSubmit(formData: FormData) {
    setError(null);
    if (slugStatus !== "ok") {
      setError("Please pick a valid, available slug.");
      return;
    }
    for (const id of selectedCategoryIds) {
      formData.append("categoryIds", id);
    }
    startTransition(async () => {
      const res = await createCommunity(formData);
      if (res?.error) {
        setError(res.error);
        // createCommunity redirects on success — any non-redirect result is an error.
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Community name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={3}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="eFootball Mobile Squad"
          className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <p className="mt-1 text-xs text-text-muted">
          The display name players will see.
        </p>
      </div>

      <div>
        <label
          htmlFor="slug"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Slug
        </label>
        <div className="flex h-11 items-stretch overflow-hidden rounded-md border border-border bg-bg focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <span className="flex items-center bg-surface px-3 text-xs text-text-muted">
            /communities/
          </span>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            minLength={3}
            maxLength={40}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            placeholder="efootball-mobile-squad"
            className="h-full w-full bg-transparent px-3 text-sm text-fg placeholder:text-text-muted focus:outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          3–40 characters. Lowercase letters, numbers, and hyphens only.
        </p>
        {slugStatus === "checking" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            Checking availability…
          </p>
        )}
        {slugStatus === "ok" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-success">
            <CheckCircle2 size={12} />
            Slug is available.
          </p>
        )}
        {slugStatus === "taken" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-sale">
            <AlertCircle size={12} />
            That slug is already taken.
          </p>
        )}
        {slugStatus === "invalid" && (
          <p className="mt-1 flex items-center gap-1 text-xs text-sale">
            <AlertCircle size={12} />
            Slug must be 3–40 lowercase letters, numbers, or hyphens.
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Description <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          placeholder="What's this community about? Who should join?"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      {categories.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">
            Categories <span className="text-text-muted">(optional, pick up to 3)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const active = selectedCategoryIds.has(cat.id);
              const disabled = !active && selectedCategoryIds.size >= 3;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  disabled={disabled}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-bg text-text-muted hover:border-accent/60 hover:text-fg"
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-sale/30 bg-sale/5 px-3 py-2 text-sm text-sale">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || slugStatus !== "ok" || name.trim().length < 3}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Creating community…
          </>
        ) : (
          <>
            Create community
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </form>
  );
}
