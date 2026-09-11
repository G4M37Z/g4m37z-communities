import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageEnter } from "@/components/PageEnter";
import { NewConversationForm } from "./NewConversationForm";

export const dynamic = "force-dynamic";

export default async function NewConversationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <PageEnter>
        <main className="container-x py-8 pb-20">
          <h1 className="text-3xl font-bold tracking-tight text-fg">New message</h1>
          <p className="mt-4 text-sm text-text-secondary">
            <Link href="/login?next=/messages/new" className="underline text-accent">
              Sign in
            </Link>{" "}
            to start a conversation.
          </p>
        </main>
      </PageEnter>
    );
  }

  return (
    <PageEnter>
      <main className="container-x py-8 pb-20 max-w-lg">
        <header className="mb-6 flex items-center gap-3">
          <Link href="/messages" className="text-sm text-accent hover:text-accent-hover">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-fg">New message</h1>
        </header>
        <NewConversationForm />
      </main>
    </PageEnter>
  );
}
