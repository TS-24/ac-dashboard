import { createPksApiClient, type Connector, type Snapshot } from "../pks-api.ts";
import { db } from "../db/client.ts";
import { cardItems, cards, tasks } from "../db/schema.ts";
import { mapAssignmentSnapshot } from "./task-mapper.ts";
import { upsertAssignment } from "./task-service.ts";
import { planCards } from "../enrichment/plan.ts";
import { applyCardPlan } from "../enrichment/apply.ts";
import { createEnrichmentModel, enrichmentEnabled } from "../enrichment/provider.ts";
import type { LanguageModel } from "ai";

export type SyncSummary = { created: number; updated: number; unchanged: number; skipped: number; enriched: number; merged: number; triagedOut: number; fallback: number };

function requireDb() {
  if (!db) throw new Error("DATABASE_URL is required");
  return db;
}

export async function syncAssignments(): Promise<SyncSummary> {
  const client = createPksApiClient();
  const connectors = await listConnectors(client);
  const summary: SyncSummary = { created: 0, updated: 0, unchanged: 0, skipped: 0, enriched: 0, merged: 0, triagedOut: 0, fallback: 0 };

  for (const connector of connectors) {
    const page = await client.snapshots.list({ connector_id: connector.id, entity_type: "assignment", limit: 200, offset: 0 });
    for (const snapshot of page.items) {
      try {
        const result = await upsertAssignment(mapAssignmentSnapshot(snapshot, connector.name));
        summary[result] += 1;
      } catch {
        summary.skipped += 1;
      }
    }
  }

  try {
    const database = requireDb();
    const allTasks = await database.select().from(tasks).orderBy(tasks.createdAt);
    const allCards = await database.select().from(cards);
    const allCardItems = await database.select().from(cardItems);

    const existingCards = allCards.map((card) => ({
      card,
      items: allCardItems.filter((ci) => ci.cardId === card.id).map((ci) => ({ taskId: ci.taskId, itemHash: ci.itemHash })),
    }));

    const model: LanguageModel | null = enrichmentEnabled() ? createEnrichmentModel() : null;

    const plans = await planCards(model, allTasks, existingCards, new Date());

    const result = await applyCardPlan(plans);
    summary.enriched = result.created + result.updated;
    summary.merged = result.merged;
    summary.triagedOut = result.archived;
    summary.fallback = plans.filter((p) => p.enrichmentStatus === "fallback").length;
  } catch (err) {
    console.error("Enrichment pipeline failed:", err);
  }

  return summary;
}

async function listConnectors(client: ReturnType<typeof createPksApiClient>): Promise<Connector[]> {
  const response = await client.connectors.list();
  return response.items;
}

export type AssignmentSnapshot = Snapshot;
