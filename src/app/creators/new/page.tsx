import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageEnter } from "@/components/PageEnter";

export const dynamic = "force-dynamic";

export default async function CreatorApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PageEnter>
        <main className="container-x py-8 pb-20 max-w-lg">
          <h1 className="text-3xl font-bold tracking-tight text-fg">Apply as creator</h1>
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/login?next=/creators/new" className="underline text-accent">
              Sign in
            </Link>{" "}
            to apply as a creator.
          </p>
        </main>
      </PageEnter>
    );
  }

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20 max-w-lg">
        <Link href="/creators" className="mb-4 inline-block text-sm text-accent hover:text-accent-hover">
          ← All creators
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-fg mb-6">
          Apply as creator
        </h1>
        <section className="rounded-lg border border-border bg-surface p-6">
          <p className="text-sm text-text-secondary">
            Creator applications are not yet open. Check back soon.
          </p>
        </section>
      </main>
    </PageEnter>
  );
}
