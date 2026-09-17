// ============================================================================
// src/lib/tournaments/frameworks.ts
// Tournament Frameworks — Logic for game-specific scoring and progression.
// ============================================================================

import { createClient } from "@/lib/supabase/server";

export type ScoringType = "points" | "win_loss" | "rank";

export interface Framework {
  id: string;
  slug: string;
  name: string;
  category: string;
  scoring_type: ScoringType;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface Stage {
  id: string;
  framework_id: string;
  stage_order: number;
  stage_name: string;
  progression_rule: Record<string, unknown>;
  created_at: string;
}

export interface ScoreEntry {
  userId: string;
  points: number;
  rank: number;
}

export interface ProgressionRule {
  top_n?: number;
  min_points?: number;
  min_rank?: number;
}

/**
 * Calculate which users advance to the next stage based on the progression rule.
 * This is the core logic for Battle Royale / Point-based global stages.
 */
export function calculateAdvancement(
  scores: ScoreEntry[],
  rule: ProgressionRule
): string[] {
  if (!rule || Object.keys(rule).length === 0) return [];

  // 1. Sort by points (desc) then rank (asc)
  const sorted = [...scores].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.rank - b.rank;
  });

  // 2. Apply filters (min points/rank)
  let filtered = sorted;
  if (rule.min_points !== undefined) {
    filtered = filtered.filter((s) => s.points >= (rule.min_points as number));
  }
  if (rule.min_rank !== undefined) {
    filtered = filtered.filter((s) => s.rank <= (rule.min_rank as number));
  }

  // 3. Apply cap (top N)
  if (rule.top_n !== undefined) {
    filtered = filtered.slice(0, rule.top_n);
  }

  return filtered.map((s) => s.userId);
}

/**
 * Creates a custom framework and its associated stages.
 */
export async function createCustomFramework(
  data: {
    name: string;
    slug: string;
    category: string;
    scoring_type: ScoringType;
    description: string;
    stages: { name: string; order: number; rule: ProgressionRule }[];
  }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: u, error: authErr } = await supabase.auth.getUser();
  if (authErr || !u?.user) return { ok: false, error: "Not authenticated" };

  // 1. Create framework
  const { data: framework, error: fErr } = await supabase
    .from("tournament_frameworks")
    .insert({
      name: data.name,
      slug: data.slug,
      category: data.category,
      scoring_type: data.scoring_type,
      description: data.description,
      created_by: u.user.id,
    })
    .select()
    .single();

  if (fErr) return { ok: false, error: fErr.message };

  // 2. Create stages
  const stagesToInsert = data.stages.map((s) => ({
    framework_id: framework.id,
    stage_name: s.name,
    stage_order: s.order,
    progression_rule: s.rule,
  }));

  const { error: sErr } = await supabase
    .from("tournament_stages")
    .insert(stagesToInsert);

  if (sErr) return { ok: false, error: sErr.message };

  return { ok: true, id: framework.id };
}

export async function listFrameworks(): Promise<Framework[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournament_frameworks")
    .select("*")
    .order("name");
  if (error || !data) return [];
  return data as Framework[];
}

export async function getFrameworkStages(frameworkId: string): Promise<Stage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("framework_id", frameworkId)
    .order("stage_order");
  if (error || !data) return [];
  return data as Stage[];
}

export const __frameworks = { calculateAdvancement };
