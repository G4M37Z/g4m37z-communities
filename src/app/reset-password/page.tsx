// src/app/reset-password/page.tsx — set a new password after a reset link
// The user reaches here via /auth/callback (type=recovery), which has already
// exchanged the recovery code and established a session cookie. If there is no
// session, the link was invalid/expired — send them back to the reset flow.

import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set a new password",
  description: "Choose a new password for your G4M37Z Communities account.",
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=reset_required");
  }

  return (
    <main className="container-x flex min-h-[80vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent-text">
            <KeyRound size={26} />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            Set a new password
          </h1>
          <p className="text-sm text-text-secondary">
            Choose a strong password you haven&apos;t used before.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
          <UpdatePasswordForm />
        </div>
      </div>
    </main>
  );
}