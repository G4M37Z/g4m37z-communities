// src/app/admin/users/page.tsx
// Admin user management — list users, change roles, ban/suspend.

import { Users } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Users — Admin — G4M37Z Communities",
  description: "Manage platform users.",
};

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  role: "member" | "moderator" | "admin" | "suspended";
  created_at: string;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const supabase = await createClient();

  let usersQuery = supabase
    .from("profiles")
    .select("id, username, display_name, role, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (query.length > 0) {
    usersQuery = usersQuery.ilike("username", `%${query}%`);
  }

  const { data: users } = await usersQuery;

  const list: UserRow[] = (users ?? []) as unknown as UserRow[];

  return (
    <>
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-fg sm:text-3xl">
          Users
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage platform users, roles, and suspensions.
        </p>
      </header>

      <form action="/admin/users" method="get" className="mb-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by username…"
          className="h-10 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Search
        </button>
      </form>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-12 text-center">
          <Users size={36} className="mx-auto mb-4 text-text-muted" />
          <h2 className="mb-1 text-base font-bold text-fg">No users found</h2>
          <p className="text-sm text-text-muted">
            {query ? `No matches for "${query}".` : "No users yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-bg text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="hidden px-4 py-3 text-left sm:table-cell">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

async function changeRoleAction(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || !role) return;

  try {
    const { error } = await supabase.rpc("admin_set_user_role", {
      p_user_id: userId,
      p_role: role,
    });
    if (error) {
      console.error("changeRole RPC failed:", error);
    }
    revalidatePath("/admin/users");
  } catch (err) {
    console.error("changeRole failed:", err);
  }
  redirect("/admin/users");
}

function UserRow({ user }: { user: UserRow }) {
  return (
    <tr className="hover:bg-bg/50">
      <td className="px-4 py-3">
        <Link
          href={`/profile/${user.username}`}
          className="font-medium text-fg hover:text-accent"
        >
          {user.display_name ?? user.username}
        </Link>
        <span className="ml-2 text-xs text-text-muted">@{user.username}</span>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="hidden px-4 py-3 text-xs text-text-muted sm:table-cell">
        {timeAgo(user.created_at)}
      </td>
      <td className="px-4 py-3 text-right">
        <RoleSelect userId={user.id} currentRole={user.role} action={changeRoleAction} />
      </td>
    </tr>
  );
}

function RoleBadge({ role }: { role: UserRow["role"] }) {
  const colors: Record<UserRow["role"], string> = {
    admin: "bg-accent/15 text-accent",
    moderator: "bg-success/15 text-success",
    member: "bg-bg text-text-muted",
    suspended: "bg-sale/15 text-sale",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[role]}`}
    >
      {role}
    </span>
  );
}

function RoleSelect({
  userId,
  currentRole,
  action,
}: {
  userId: string;
  currentRole: UserRow["role"];
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent/30"
        aria-label="Change role"
      >
        <option value="member">Member</option>
        <option value="moderator">Moderator</option>
        <option value="admin">Admin</option>
        <option value="suspended">Suspended</option>
      </select>
      <button
        type="submit"
        className="h-8 rounded-md bg-accent px-2 text-xs font-medium text-white hover:bg-accent-hover"
      >
        Set
      </button>
    </form>
  );
}
