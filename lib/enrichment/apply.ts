import { and, eq, inArray } from "drizzle-orm";

import { db } from "../db/client.ts";
import { cardItems, cards } from "../db/schema.ts";
import type { CardPlan } from "./plan.ts";

export type ApplyResult = {
  created: number;
  updated: number;
  archived: number;
  merged: number;
};

function requireDb() {
  if (!db) throw new Error("DATABASE_URL is required");
  return db;
}

export async function applyCardPlan(plans: CardPlan[]): Promise<ApplyResult> {
  if (plans.length === 0) return { created: 0, updated: 0, archived: 0, merged: 0 };

  const database = requireDb();
  let created = 0;
  let updated = 0;
  let archived = 0;
  let merged = 0;

  await database.transaction(async (tx) => {
    for (const plan of plans) {
      if (plan.op === "archive") {
        const existingCardId = plan.cardId;
        if (existingCardId) {
          const existingCard = await tx.select().from(cards).where(eq(cards.id, existingCardId)).limit(1);
          if (existingCard[0]) {
            await tx.update(cards)
              .set({
                archivedAt: new Date(),
                archivedReason: plan.archivedReason ?? null,
                updatedAt: new Date(),
              })
              .where(eq(cards.id, existingCardId));
            archived++;
            continue;
          }
        }
        const [card] = await tx.insert(cards).values({
          title: plan.title,
          summary: plan.summary,
          priority: plan.priority,
          dueAt: plan.dueAt,
          primarySource: plan.primarySource,
          sourceUrl: plan.sourceUrl,
          archivedAt: new Date(),
          archivedReason: plan.archivedReason ?? null,
          enrichmentStatus: plan.enrichmentStatus,
          enrichmentModel: plan.enrichmentModel,
          inputHash: plan.inputHash,
          enrichedAt: new Date(),
        }).returning();
        if (plan.taskIds.length > 0) {
          await tx.insert(cardItems).values(
            plan.taskIds.map((taskId) => ({
              cardId: card.id,
              taskId,
              itemHash: plan.inputHash,
            })),
          );
        }
        archived++;
        continue;
      }

      if (plan.op === "update" && plan.cardId) {
        const existingCard = await tx.select().from(cards).where(eq(cards.id, plan.cardId)).limit(1);
        if (existingCard[0]) {
          await tx.update(cards)
            .set({
              title: plan.title,
              summary: plan.summary,
              priority: plan.priority,
              dueAt: plan.dueAt,
              primarySource: plan.primarySource,
              sourceUrl: plan.sourceUrl,
              enrichmentStatus: plan.enrichmentStatus,
              enrichmentModel: plan.enrichmentModel,
              inputHash: plan.inputHash,
              enrichedAt: new Date(),
              updatedAt: new Date(),
              archivedAt: null,
              archivedReason: null,
              // preserve user's kanbanStatus and position
            })
            .where(eq(cards.id, plan.cardId));

          const existingItems = await tx.select().from(cardItems).where(eq(cardItems.cardId, plan.cardId));
          const existingTaskIds = new Set(existingItems.map((i) => i.taskId));
          const plannedTaskIds = new Set(plan.taskIds);

          const toRemove = existingItems.filter((i) => !plannedTaskIds.has(i.taskId));
          if (toRemove.length > 0) {
            await tx.delete(cardItems).where(
              and(eq(cardItems.cardId, plan.cardId), inArray(cardItems.taskId, toRemove.map((i) => i.taskId))),
            );
          }

          const toAdd = plan.taskIds.filter((tid) => !existingTaskIds.has(tid));
          if (toAdd.length > 0) {
            await tx.insert(cardItems).values(
              toAdd.map((taskId) => ({
                cardId: plan.cardId!,
                taskId,
                itemHash: plan.inputHash,
              })),
            );
          }

          if (toAdd.length > 0) merged++;
          else updated++;
          continue;
        }
      }

      const [card] = await tx.insert(cards).values({
        title: plan.title,
        summary: plan.summary,
        priority: plan.priority,
        dueAt: plan.dueAt,
        primarySource: plan.primarySource,
        sourceUrl: plan.sourceUrl,
        enrichmentStatus: plan.enrichmentStatus,
        enrichmentModel: plan.enrichmentModel,
        inputHash: plan.inputHash,
        enrichedAt: new Date(),
      }).returning();

      if (plan.taskIds.length > 0) {
        await tx.insert(cardItems).values(
          plan.taskIds.map((taskId) => ({
            cardId: card.id,
            taskId,
            itemHash: plan.inputHash,
          })),
        );
      }
      created++;
    }
  });

  return { created, updated, archived, merged };
}
