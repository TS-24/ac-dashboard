import { asc, eq, isNull } from "drizzle-orm";

import { db } from "../db/client.ts";
import { cardItems, cards, type CardRow } from "../db/schema.ts";

export type CardWithCount = CardRow & { itemCount: number };

export type CardStatus = "backlog" | "in_progress" | "review" | "done";
export type CardPriority = "high" | "medium" | "low";

function requireDb() {
  if (!db) throw new Error("DATABASE_URL is required");
  return db;
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
