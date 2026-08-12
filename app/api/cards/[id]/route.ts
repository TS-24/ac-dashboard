import { NextResponse } from "next/server";

import { updateCard, type CardStatus } from "../../../../lib/cards/card-service.ts";

const statuses = new Set<CardStatus>(["backlog", "in_progress", "review", "done"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { kanban_status?: unknown; position?: unknown };
  const input: { kanbanStatus?: CardStatus; position?: number } = {};

  if (body.kanban_status !== undefined) {
    if (typeof body.kanban_status !== "string" || !statuses.has(body.kanban_status as CardStatus)) {
      return NextResponse.json({ error: { code: "INVALID_STATUS", message: "Invalid kanban status" } }, { status: 400 });
    }
    input.kanbanStatus = body.kanban_status as CardStatus;
  }
  if (body.position !== undefined) {
    if (typeof body.position !== "number" || !Number.isInteger(body.position) || body.position < 0) {
      return NextResponse.json({ error: { code: "INVALID_POSITION", message: "Position must be a non-negative integer" } }, { status: 400 });
    }
    input.position = body.position;
  }

  try {
    const card = await updateCard(id, input);
    return card ? NextResponse.json(card) : NextResponse.json({ error: { code: "NOT_FOUND", message: "Card not found" } }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: { code: "CARD_UPDATE_FAILED", message: error instanceof Error ? error.message : "Card update failed" } }, { status: 503 });
  }
}
