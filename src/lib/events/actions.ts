"use server";
// Events server actions. Thin wrappers around the service helpers.

import {
  createEvent as svcCreate,
  updateEvent as svcUpdate,
  publishEvent as svcPublish,
  cancelEvent as svcCancel,
  deleteEvent as svcDelete,
  rsvpEvent as svcRsvp,
  cancelRsvpEvent as svcCancelRsvp,
  type CreateEventInput,
  type UpdateEventInput,
  type EventResult,
} from "@/lib/events/service";

export interface ActionResult {
  ok: boolean;
  status: EventResult["status"];
  error?: string;
  eventId?: string;
}

export async function createEventAction(
  input: CreateEventInput,
): Promise<ActionResult> {
  return resultToAction(await svcCreate(input));
}

export async function updateEventAction(
  eventId: string,
  input: UpdateEventInput,
): Promise<ActionResult> {
  return resultToAction(await svcUpdate(eventId, input));
}

export async function publishEventAction(
  eventId: string,
): Promise<ActionResult> {
  return resultToAction(await svcPublish(eventId));
}

export async function cancelEventAction(
  eventId: string,
): Promise<ActionResult> {
  return resultToAction(await svcCancel(eventId));
}

export async function deleteEventAction(
  eventId: string,
): Promise<ActionResult> {
  return resultToAction(await svcDelete(eventId));
}

export async function rsvpEventAction(
  eventId: string,
): Promise<ActionResult> {
  return resultToAction(await svcRsvp(eventId));
}

export async function cancelRsvpEventAction(
  eventId: string,
): Promise<ActionResult> {
  return resultToAction(await svcCancelRsvp(eventId));
}

function resultToAction(r: EventResult): ActionResult {
  return r.ok
    ? { ok: true, status: r.status, eventId: r.eventId }
    : {
        ok: false,
        status: r.status,
        error: r.error ?? "Action failed",
      };
}
