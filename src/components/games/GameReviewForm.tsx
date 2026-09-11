"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createReviewAction,
  updateReviewAction,
  deleteReviewAction,
} from "@/lib/games/actions";

const CATEGORY_FIELDS: Array<{
  key: string;
  label: string;
}> = [
  { key: "gameplay", label: "Gameplay" },
  { key: "graphics", label: "Graphics" },
  { key: "performance", label: "Performance" },
  { key: "story", label: "Story" },
  { key: "audio", label: "Audio" },
  { key: "value", label: "Value" },
];

interface ReviewDraft {
  reviewId?: string;
  gameplayScore?: number | null;
  graphicsScore?: number | null;
  performanceScore?: number | null;
  storyScore?: number | null;
  audioScore?: number | null;
  valueScore?: number | null;
  overallScore?: number | null;
  body?: string | null;
}

export function GameReviewForm({
  gameId,
  gameSlug,
  gameName,
  existing,
}: {
  gameId: string;
  gameSlug: string;
  gameName: string;
  existing: ReviewDraft | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = existing !== null;

  function parseScore(formData: FormData, key: string): number | null {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    return Number(raw);
  }

  function buildDraft(formData: FormData): ReviewDraft {
    return {
      gameplayScore: parseScore(formData, "gameplay"),
      graphicsScore: parseScore(formData, "graphics"),
      performanceScore: parseScore(formData, "performance"),
      storyScore: parseScore(formData, "story"),
      audioScore: parseScore(formData, "audio"),
      valueScore: parseScore(formData, "value"),
      overallScore: parseScore(formData, "overall"),
      body: String(formData.get("body") ?? "").trim() || null,
    };
  }

  function onSubmit(formData: FormData) {
    setError(null);

    if (isEdit && existing?.reviewId) {
      startTransition(async () => {
        const res = await updateReviewAction({
          reviewId: existing.reviewId as string,
          ...buildDraft(formData),
        });
        if (res.ok) {
          router.push(`/game/${gameSlug}`);
          router.refresh();
        } else {
          setError(res.error ?? "Failed to update review");
        }
      });
    } else {
      startTransition(async () => {
        const res = await createReviewAction({
          gameId,
          ...buildDraft(formData),
        });
        if (res.ok) {
          router.push(`/game/${gameSlug}`);
          router.refresh();
        } else {
          setError(res.error ?? "Failed to post review");
        }
      });
    }
  }

  function onDelete() {
    if (!isEdit) return;
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteReviewAction(existing?.reviewId as string);
      if (res.ok) {
        router.push(`/game/${gameSlug}`);
        router.refresh();
      } else {
        setError(res.error ?? "Failed to delete review");
      }
    });
  }

  return (
    <form
      action={onSubmit}
      className="mt-6 grid max-w-2xl grid-cols-1 gap-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CATEGORY_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-text-muted">
              {f.label}
            </span>
            <input
              type="number"
              name={f.key}
              min={1}
              max={10}
              step={1}
              defaultValue={
                existing?.[f.key as keyof ReviewDraft]?.toString() ?? ""
              }
              placeholder="1–10"
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Overall score (0–100)
        </span>
        <input
          type="number"
          name="overall"
          min={0}
          max={100}
          step={1}
          defaultValue={existing?.overallScore?.toString() ?? ""}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-text-muted">
          Review
        </span>
        <textarea
          name="body"
          maxLength={8000}
          rows={6}
          defaultValue={existing?.body ?? ""}
          placeholder={`What did you think of ${gameName}?`}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="press inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending
            ? isEdit
              ? "Saving…"
              : "Posting…"
            : isEdit
              ? "Save changes"
              : "Post review"}
        </button>
        {isEdit && (
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="press inline-flex h-10 items-center rounded-md border border-sale px-4 text-sm font-semibold text-sale hover:bg-sale/10 disabled:opacity-60"
          >
            Delete review
          </button>
        )}
        {error && (
          <p role="alert" className="text-xs text-sale">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}