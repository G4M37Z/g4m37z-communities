// src/app/admin/layout.tsx
// Admin area — server-side guard that gates access to admins only.
// Renders the admin sidebar + content for nested routes.

import { redirect } from "next/navigation";
import Link from "next/link";
import { Shield, Flag, BarChart3, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin — G4M37Z Communities",
  description: "Admin dashboard for G4M37Z Communities.",
};

const NAV = [
  { label: "Dashboard", href: "/admin", icon: BarChart3 },
  { label: "Reports", href: "/admin/reports", icon: Flag },
  { label: "Users", href: "/admin/users", icon: Users },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin" && profile?.role !== "moderator") {
    redirect("/?error=admin_only");
  }

  return (
    <main className="container-x py-8 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-4 flex items-center gap-2 px-2">
            <Shield size={18} className="text-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-fg">
              Admin
            </h2>
          </div>
          <nav className="rounded-2xl border border-border bg-surface p-2">
            <ul className="space-y-1">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-fg hover:bg-bg hover:text-accent transition-colors"
                    >
                      <Icon size={14} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}