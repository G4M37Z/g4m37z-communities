"use client";

// src/components/SignOutButton.tsx
// Calls the signOut server action from a form (no client-side state).

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/supabase/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-fg hover:bg-surface"
      >
        <LogOut size={14} />
        Sign out
      </button>
    </form>
  );
}
