// ============================================================================
// src/lib/tournaments/frameworks-service.ts
// Tournament Frameworks — server data access for framework + stage CRUD.
//
// Security model:
//   - Reads use the caller-supplied Supabase client (public SELECT via RLS).
//   - Mutations go through createAdminClient (service_role); the actor's
//     identity is resolved server-side from the cookie session, never from
//     the client. created_by is pinned to that resolved user.
//   - Framework writes are NOT organiser-gated (any authenticated member may
//     define a format), matching the RLS model in 043_tournament_frameworks.sql.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Framework,
  type Stage,
  type ScoringType,
  type ProgressionRule,
} from "@/lib/tournaments/frameworks";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_NAME_LEN = 120;
const MAX_DESC_LEN = 1000;

export async function listFrameworks(supabase: SupabaseClient): Promise<Framework[]> {
  const { data, error } = await supabase
    .from("tournament_frameworks")
    .select("*")
    .order("name");
  if (error || !data) return [];
  return data as Framework[];
}

export async function getFrameworkStages(
  supabase: SupabaseClient,
  frameworkId: string,
): Promise<Stage[]> {
  const { data, error } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("framework_id", frameworkId)
    .order("stage_order", { ascending: true });
  if (error || !data) return [];
  return data as Stage[];
}

export interface CreateCustomFrameworkInput {
  name: string;
  slug: string;
  category: string;
  scoring_type: ScoringType;
  description: string;
  stages: { name: string; order: number; rule: ProgressionRule }[];
  gameId?: string | null;
}

/**
 * Creates a custom framework and its associated stages. Mirrors the RLS
 * contract (framework owned by the actor; stages gated on that ownership)
 * but writes via the admin client with the identity resolved server-side,
 * consistent with the other tournament mutations in ./service.ts.
 */
export async function createCustomFramework(
  input: CreateCustomFrameworkInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u?.user) return { ok: false, error: "Not authenticated" };

  const name = (input.name ?? "").trim();
  const slug = (input.slug ?? "").trim().toLowerCase();
  const description = (input.description ?? "").trim();

  if (!name || name.length > MAX_NAME_LEN) {
    return { ok: false, error: "Framework name is required (max 120 chars)." };
  }
  if (!SLUG_RE.test(slug) || slug.length > 64) {
    return {
      ok: false,
      error: "Slug must be lowercase letters/numbers/dashes, e.g. fncs-2026.",
    };
  }
  const SCORING_TYPES: ScoringType[] = ["points", "win_loss", "rank"];
  if (!SCORING_TYPES.includes(input.scoring_type)) {
    return { ok: false, error: "Unknown scoring type." };
  }
  if (description.length > MAX_DESC_LEN) {
    return { ok: false, error: "Description is too long." };
  }
  const stages = (input.stages ?? [])
    .filter((s) => (s.name ?? "").trim().length > 0)
    .map((s) => ({ ...s, name: (s.name ?? "").trim() }));
  if (stages.length === 0) {
    return { ok: false, error: "A framework needs at least one stage." };
  }
  const orders = new Set(stages.map((s) => s.order));
  if (orders.size !== stages.length) {
    return { ok: false, error: "Stage orders must be unique." };
  }
  const gameId = (input.gameId ?? "").trim();
  if (gameId && !UUID_RE.test(gameId)) {
    return { ok: false, error: "Invalid game selected." };
  }

  const session = createAdminClient();

  const { data: framework, error: fErr } = await session
    .from("tournament_frameworks")
    .insert({
      name,
      slug,
      category: (input.category ?? "").trim() || null,
      scoring_type: input.scoring_type,
      description: description || null,
      game_id: gameId || null,
      created_by: u.user.id,
    })
    .select("id")
    .single();

  if (fErr) return { ok: false, error: fErr.message };

  const stagesToInsert = stages.map((s) => ({
    framework_id: framework.id,
    stage_name: s.name,
    stage_order: s.order,
    progression_rule: s.rule ?? {},
  }));

  const { error: sErr } = await session
    .from("tournament_stages")
    .insert(stagesToInsert);

  if (sErr) {
    // Best-effort cleanup so a failed stage insert cannot orphan a framework.
    await session.from("tournament_frameworks").delete().eq("id", framework.id);
    return { ok: false, error: sErr.message };
  }

  return { ok: true, id: framework.id as string };
}