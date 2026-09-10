"use server";
// LFG server actions. Thin wrappers around the service helpers; called by
// Client Components. Each action resolves the authenticated user server-side
// via createAdminClient and never trusts client-supplied user IDs.

import {
  createLfgSession as svcCreate,
  updateLfgSession as svcUpdate,
  closeLfgSession as svcClose,
  cancelLfgSession as svcCancel,
  deleteLfgSession as svcDelete,
  joinLfgSession as svcJoin,
  leaveLfgSession as svcLeave,
  type CreateLfgInput,
  type UpdateLfgInput,
  type LfgResult,
} from "@/lib/lfg/service";

export interface ActionResult {
  ok: boolean;
  status: LfgResult["status"];
  error?: string;
  sessionId?: string;
}

export async function createLfgAction(
  input: CreateLfgInput,
): Promise<ActionResult> {
  const r = await svcCreate(input);
  return resultToAction(r);
}

export async function updateLfgAction(
  sessionId: string,
  input: UpdateLfgInput,
): Promise<ActionResult> {
  const r = await svcUpdate(sessionId, input);
  return resultToAction(r);
}

export async function closeLfgAction(
  sessionId: string,
): Promise<ActionResult> {
  const r = await svcClose(sessionId);
  return resultToAction(r);
}

export async function cancelLfgAction(
  sessionId: string,
): Promise<ActionResult> {
  const r = await svcCancel(sessionId);
  return resultToAction(r);
}

export async function deleteLfgAction(
  sessionId: string,
): Promise<ActionResult> {
  const r = await svcDelete(sessionId);
  return resultToAction(r);
}

export async function joinLfgAction(
  sessionId: string,
): Promise<ActionResult> {
  const r = await svcJoin(sessionId);
  return resultToAction(r);
}

export async function leaveLfgAction(
  sessionId: string,
): Promise<ActionResult> {
  const r = await svcLeave(sessionId);
  return resultToAction(r);
}

function resultToAction(r: LfgResult): ActionResult {
  return r.ok
    ? { ok: true, status: r.status, sessionId: r.sessionId }
    : {
        ok: false,
        status: r.status,
        error: r.error ?? "Action failed",
      };
}
