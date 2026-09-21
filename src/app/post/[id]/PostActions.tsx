"use client";

// src/app/post/[id]/PostActions.tsx
// Edit + delete controls for post owners.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Check,
  ImagePlus,
} from "lucide-react";
import { deletePost, editPost, uploadPostImage } from "@/lib/posts/actions";
import type { Post } from "@/types/database";

interface Props {
  post: Post & {
    author: { username: string } | null;
    community: { slug: string } | null;
  };
}

export function PostActions({ post }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deletePost(post.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      // Navigate back to the community (or home fallback).
      router.push(post.community ? `/communities/${post.community.slug}` : "/home");
    });
  }

  if (editing) {
    return (
      <EditForm
        post={post}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    );
  }

  if (confirmDelete) {
    return (
      <div className="flex flex-col items-end gap-2">
        <p className="text-xs text-sale">Delete this post? This can&apos;t be undone.</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-sale px-3 text-xs font-semibold text-white hover:bg-sale/90 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            Delete
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmDelete(false)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg px-3 text-xs font-medium text-fg hover:border-accent/60"
          >
            Cancel
          </button>
        </div>
        {error && (
          <p className="flex items-center gap-1 text-xs text-sale">
            <AlertCircle size={12} /> {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-xs font-medium text-fg hover:border-accent/60 hover:text-accent-text"
      >
        <Pencil size={12} />
        Edit
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-xs font-medium text-fg hover:border-sale hover:text-sale"
      >
        <Trash2 size={12} />
        Delete
      </button>
    </div>
  );
}

function EditForm({
  post,
  onCancel,
  onSaved,
}: {
  post: Post & { community: { slug: string } | null };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  // GAP-POST-01: submit stays disabled until React is attached so the first
  // Save click on a freshly mounted edit form can never fall through to a
  // native form GET (house hydration-gate pattern, cf. MessageForm).
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(post.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Deferred per react-hooks/set-state-in-effect (house pattern, cf. ThemeToggle).
    queueMicrotask(() => setHydrated(true));
  }, []);

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
  }

  function onSubmit(formData: FormData) {
    setError(null);
    // Express the image intent explicitly — FormData cannot carry null.
    if (imageUrl) {
      formData.set("imageUrl", imageUrl);
    } else {
      formData.set("removeImage", "true");
    }
    startTransition(async () => {
      try {
        const res = await editPost(formData);
        if (res?.error) {
          setError(res.error);
          return;
        }
        onSaved();
      } catch {
        setError("Couldn't update the post. Try again.");
      }
    });
  }

  return (
    // GAP-POST-01 hardening: no action until hydrated — implicit native
    // submission (Enter) has nothing to fall through to.
    <form action={hydrated ? onSubmit : undefined} className="w-full space-y-2">
      <input type="hidden" name="postId" value={post.id} />
      <input
        name="title"
        defaultValue={post.title}
        required
        minLength={3}
        maxLength={200}
        className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <textarea
        name="body"
        defaultValue={post.body ?? ""}
        rows={4}
        maxLength={20000}
        className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />

      <div>
        <span className="mb-1.5 block text-xs font-medium text-text-muted">
          Image
        </span>
        {imageUrl ? (
          <div className="relative overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="block max-h-60 w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                setImageUrl(null);
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
            htmlFor="edit-image"
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg px-4 py-4 text-xs text-text-muted hover:border-accent/60 hover:text-fg"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <ImagePlus size={14} />
                Add an image
              </>
            )}
            <input
              ref={fileInputRef}
              id="edit-image"
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
        {uploadError && <p className="mt-1 text-xs text-sale">{uploadError}</p>}
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-sale">
          <AlertCircle size={12} /> {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-xs font-medium text-fg hover:border-accent/60"
        >
          <X size={12} />
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || uploading || !hydrated}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Save
        </button>
      </div>
    </form>
  );
}