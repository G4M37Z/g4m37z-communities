import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CommunityCapabilitiesForm } from "@/components/community-capabilities-form";
import { getCommunityContext } from "@/lib/community-service";

export const dynamic = "force-dynamic";

export default async function CommunitySettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/communities/${slug}/settings`);
  }

  const ctx = await getCommunityContext(slug, user.id);
  if (!ctx.community) {
    notFound();
  }

  if (!ctx.canModerate) {
    redirect(`/communities/${slug}?error=settings_moderators_only`);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-20">
      <Link
        href={`/communities/${slug}`}
        className="text-xs text-text-muted hover:text-fg"
      >
        ← Back to {ctx.community.name}
      </Link>
      <h1 className="mb-1 mt-3 text-2xl font-black tracking-[-0.03em] text-fg">
        Community Settings
      </h1>
      <p className="mb-6 text-sm text-text-secondary">
        Manage capabilities for {ctx.community.name}. Only moderators and
        admins can change these.
      </p>
      <CommunityCapabilitiesForm />
    </main>
  );
}