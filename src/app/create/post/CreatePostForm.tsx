"use client";

// src/app/create/post/CreatePostForm.tsx
// Form for creating a post. Title + body + optional image + community picker.

import { useState, useTransition, useRef } from "react";
import {
  Loader2,
  AlertCircle,
  ArrowRight,
  ImagePlus,
  X,
} from "lucide-react";
import { createPost, uploadPostImage } from "@/lib/posts/actions";

interface Props {
  communities: { id: string; slug: string; name: string }[];
  defaultCommunityId: string;
}

const IMAGE_MAX_MB = 5;

export function CreatePostForm({ communities, defaultCommunityId }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function onFile(file: File) {
    setUploading(true);
    setUploadError(null);
    const res = await uploadPostImage(file);
    setUploading(false);
    if (res.error) {
      setUploadError(res.error);
      return;
    }
    setImageUrl(res.url ?? null);
    setImagePath(res.path ?? null);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    if (imageUrl) formData.set("imageUrl", imageUrl);
    startTransition(async () => {
      const res = await createPost(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="communityId"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Community
        </label>
        <select
          id="communityId"
          name="communityId"
          required
          defaultValue={defaultCommunityId}
          className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-text-muted">
          You can only post in communities you&apos;ve joined.
        </p>
      </div>

      <div>
        <label
          htmlFor="title"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={200}
          placeholder="What do you want to share?"
          className="h-11 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <p className="mt-1 text-xs text-text-muted">
          3–200 characters. Be specific.
        </p>
      </div>

      <div>
        <label
          htmlFor="body"
          className="mb-1.5 block text-sm font-medium text-fg"
        >
          Body <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={6}
          maxLength={20000}
          placeholder="Add detail. Markdown isn't supported yet — plain text only."
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-fg">
          Image <span className="text-text-muted">(optional)</span>
        </span>
        {imageUrl ? (
          <div className="relative overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt=""
              className="block max-h-72 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setImageUrl(null);
                setImagePath(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-bg/90 text-text-muted hover:text-sale"
              aria-label="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <label
            htmlFor="image"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg px-4 py-6 text-sm text-text-muted hover:border-accent/60 hover:text-fg"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <ImagePlus size={16} />
                Click to attach an image (max {IMAGE_MAX_MB} MB)
              </>
            )}
            <input
              ref={fileInputRef}
              id="image"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
        )}
        {uploadError && (
          <p className="mt-1 text-xs text-sale">{uploadError}</p>
        )}
        {imagePath && (
          <p className="mt-1 text-xs text-text-muted">
            Stored at <code className="text-fg">{imagePath}</code>
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-sale/30 bg-sale/5 px-3 py-2 text-sm text-sale">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || uploading}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Publishing…
          </>
        ) : (
          <>
            Publish
            <ArrowRight size={16} />
          </>
        )}
      </button>
    </form>
  );
}