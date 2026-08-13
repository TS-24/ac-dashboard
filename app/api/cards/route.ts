import { NextResponse } from "next/server";

import { createCard, listCards, type CardPriority, type CardStatus } from "../../../lib/cards/card-service.ts";

const statuses = new Set<CardStatus>(["backlog", "in_progress", "review", "done"]);
const priorities = new Set<CardPriority>(["high", "medium", "low"]);

type CardCreateBody = { title?: unknown; summary?: unknown; priority?: unknown; kanban_status?: unknown };

export async function POST(request: Request) {
  let body: CardCreateBody;
  try {
    body = (await request.json()) as CardCreateBody;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_BODY", message: "Body must be JSON" } }, { status: 400 });
  }

  try {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      return NextResponse.json({ error: { code: "INVALID_TITLE", message: "Title is required" } }, { status: 400 });
    }

    const input: { title: string; summary?: string | null; priority?: CardPriority; kanbanStatus?: CardStatus } = {
      title: body.title.trim(),
    };

    if (body.summary !== undefined) {
      input.summary = typeof body.summary === "string" ? body.summary : null;
    }
    if (body.priority !== undefined) {
      if (typeof body.priority !== "string" || !priorities.has(body.priority as CardPriority)) {
        return NextResponse.json({ error: { code: "INVALID_PRIORITY", message: "Priority must be high, medium, or low" } }, { status: 400 });
      }
      input.priority = body.priority as CardPriority;
    }
    if (body.kanban_status !== undefined) {
      if (typeof body.kanban_status !== "string" || !statuses.has(body.kanban_status as CardStatus)) {
        return NextResponse.json({ error: { code: "INVALID_STATUS", message: "Invalid kanban status" } }, { status: 400 });
      }
      input.kanbanStatus = body.kanban_status as CardStatus;
    }

    const card = await createCard(input);
    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: { code: "CARD_CREATE_FAILED", message: error instanceof Error ? error.message : "Card create failed" } }, { status: 503 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({ items: await listCards() });
  } catch (error) {
    return NextResponse.json({ error: { code: "CARDS_UNAVAILABLE", message: error instanceof Error ? error.message : "Cards unavailable" } }, { status: 503 });
  }
}
