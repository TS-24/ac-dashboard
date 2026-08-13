import { createHash } from "node:crypto";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { db } from "../db/client.ts";
import { cardItems, cards, type CardRow, type NewCard } from "../db/schema.ts";

export type CardWithCount = CardRow & { itemCount: number };

export type CardStatus = "backlog" | "in_progress" | "review" | "done";
export type CardPriority = "high" | "medium" | "low";

function requireDb() {
  if (!db) throw new Error("DATABASE_URL is required");
  return db;
}

export async function createCard(input: {
  title: string;
  summary?: string | null;
  priority?: CardPriority;
  dueAt?: Date | null;
  kanbanStatus?: CardStatus;
}): Promise<CardRow> {
  const hash = createHash("sha256")
    .update(input.title)
    .update("\0")
    .update(input.summary ?? "")
    .update("\0")
    .update(Date.now().toString())
    .digest("hex");

  const database = requireDb();
  const kanbanStatus = input.kanbanStatus ?? "backlog";

  // The board appends new cards to the bottom of a column, so the stored position
  // has to land past every sibling or a reload would sort it back to the top.
  const [last] = await database
    .select({ position: cards.position })
    .from(cards)
    .where(and(eq(cards.kanbanStatus, kanbanStatus), isNull(cards.archivedAt)))
    .orderBy(desc(cards.position))
    .limit(1);

  const value: NewCard = {
    title: input.title,
    summary: input.summary ?? null,
    priority: input.priority ?? "medium",
    dueAt: input.dueAt ?? null,
    kanbanStatus,
    position: last ? last.position + 1 : 0,
    primarySource: "Manual",
    inputHash: hash,
  };

  const [card] = await database.insert(cards).values(value).returning();
  return card;
}

export async function listCards(): Promise<CardWithCount[]> {
  const database = requireDb();
  const rows = await database
    .select()
    .from(cards)
    .where(isNull(cards.archivedAt))
    .orderBy(asc(cards.kanbanStatus), asc(cards.position), asc(cards.createdAt));

  const itemCounts = new Map<string, number>();
  const allCardItems = await database.select().from(cardItems);
  for (const ci of allCardItems) {
    itemCounts.set(ci.cardId, (itemCounts.get(ci.cardId) ?? 0) + 1);
  }

  return rows.map((card) => ({
    ...card,
    itemCount: itemCounts.get(card.id) ?? 0,
  }));
}

export async function updateCard(
  cardId: string,
  input: { kanbanStatus?: CardStatus; position?: number },
): Promise<CardRow | null> {
  const [card] = await requireDb()
    .update(cards)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(cards.id, cardId))
    .returning();
  return card ?? null;
}
