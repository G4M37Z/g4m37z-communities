// src/app/forgot-password/page.tsx — request a password reset email
import { Logo } from "@/components/Logo";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { sanitizeNextPath } from "@/lib/supabase/auth-urls";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Forgot password",
  description: "Reset your G4M37Z Communities password.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNextPath(params.next, "/");

  return (
    <main className="container-x flex min-h-[80vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-5 flex w-fit mx-auto text-fg">
            <Logo height={34} />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            Forgot your password?
          </h1>
          <p className="text-sm text-text-secondary">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
          <ForgotPasswordForm next={next} />
        </div>
      </div>
    </main>
  );
}