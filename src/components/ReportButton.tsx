// src/components/ReportButton.tsx
// Small "Report" button + modal for flagging posts/comments.

"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import type { ReportTargetType } from "@/types/database";
import { createReport } from "@/lib/reports/actions";

interface Props {
  targetType: ReportTargetType;
  targetId: string;
}

export function ReportButton({ targetType, targetId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const res = await createReport({
      target_type: targetType,
      target_id: targetId,
      reason: reason.trim() || undefined,
    });
    setSubmitting(false);
    if (res.error) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setMessage({ type: "success", text: "Report submitted. Thanks." });
    setReason("");
    setTimeout(() => {
      setOpen(false);
      setMessage(null);
    }, 1500);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-bg hover:text-sale transition-colors"
        aria-label={`Report ${targetType}`}
      >
        <Flag size={12} />
        Report
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-bg p-6 shadow-xl">
            <h3 id="report-title" className="mb-2 text-base font-bold text-fg">
              Report this {targetType}
            </h3>
            <p className="mb-4 text-sm text-text-muted">
              Tell us what&apos;s wrong. Reports are reviewed by moderators.
            </p>

            <form onSubmit={onSubmit}>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="What's wrong with this content?"
                className="w-full rounded-md border border-border bg-surface p-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
                autoFocus
              />
              <p className="mt-1 text-right text-xs text-text-muted">
                {reason.length}/500
              </p>

              {message && (
                <div
                  className={`mb-3 rounded-md px-3 py-2 text-sm ${
                    message.type === "success"
                      ? "bg-success/10 text-success"
                      : "bg-sale/10 text-sale"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="rounded-md border border-border bg-bg px-4 py-2 text-sm font-medium text-fg hover:border-accent disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-sale px-4 py-2 text-sm font-semibold text-white hover:bg-sale/90 disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}