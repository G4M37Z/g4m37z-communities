"use server";
// Tournament server actions. Thin wrappers around the service helpers.

import {
  createTournament as svcCreate,
  updateTournament as svcUpdate,
  deleteTournament as svcDelete,
  registerTeam as svcRegister,
  withdrawTeam as svcWithdraw,
  createMatch as svcCreateMatch,
  submitResult as svcSubmitResult,
  createDispute as svcCreateDispute,
  resolveDispute as svcResolveDispute,
  withdrawDispute as svcWithdrawDispute,
  type CreateTournamentInput,
  type UpdateTournamentInput,
  type RegisterTeamInput,
  type CreateMatchInput,
  type SubmitResultInput,
  type CreateDisputeInput,
  type ResolveDisputeInput,
} from "@/lib/tournaments/service";

export interface ActionResult {
  ok: boolean;
  status: string;
  error?: string;
  id?: string;
}

function toAction(r: {
  ok: boolean;
  status: string;
  error?: string;
  id?: string;
}): ActionResult {
  return r.ok
    ? { ok: true, status: r.status, id: r.id }
    : { ok: false, status: r.status, error: r.error ?? "Action failed" };
}

export async function createTournamentAction(
  input: CreateTournamentInput,
): Promise<ActionResult> {
  return toAction(await svcCreate(input));
}

export async function updateTournamentAction(
  tournamentId: string,
  input: UpdateTournamentInput,
): Promise<ActionResult> {
  return toAction(await svcUpdate(tournamentId, input));
}

export async function deleteTournamentAction(
  tournamentId: string,
): Promise<ActionResult> {
  return toAction(await svcDelete(tournamentId));
}

export async function registerTeamAction(
  input: RegisterTeamInput,
): Promise<ActionResult> {
  return toAction(await svcRegister(input));
}

export async function withdrawTeamAction(teamId: string): Promise<ActionResult> {
  return toAction(await svcWithdraw(teamId));
}

export async function createMatchAction(
  input: CreateMatchInput,
): Promise<ActionResult> {
  return toAction(await svcCreateMatch(input));
}

export async function submitResultAction(
  input: SubmitResultInput,
): Promise<ActionResult> {
  return toAction(await svcSubmitResult(input));
}

export async function createDisputeAction(
  input: CreateDisputeInput,
): Promise<ActionResult> {
  return toAction(await svcCreateDispute(input));
}

export async function resolveDisputeAction(
  input: ResolveDisputeInput,
): Promise<ActionResult> {
  return toAction(await svcResolveDispute(input));
}

export async function withdrawDisputeAction(
  disputeId: string,
): Promise<ActionResult> {
  return toAction(await svcWithdrawDispute(disputeId));
}
