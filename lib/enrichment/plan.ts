import type { LanguageModel } from "ai";

import type { CardRow, TaskRow } from "../db/schema.ts";
import { itemHash, groupHash } from "./hash.ts";
import { derivePriority } from "./priority.ts";
import { triageItems } from "./triage.ts";
import { candidateClusters } from "./group.ts";
import { confirmGroups } from "./group-merge.ts";
import { phraseCards } from "./phrase.ts";

export type CardPlan = {
  op: "create" | "update" | "archive";
  cardId?: string;
  taskIds: string[];
  title: string;
  summary: string | null;
  priority: "high" | "medium" | "low";
  dueAt: Date | null;
  primarySource: string;
  sourceUrl: string | null;
  inputHash: string;
  enrichmentStatus: "enriched" | "fallback";
  enrichmentModel: string | null;
  archivedReason?: string;
  /** Cards absorbed by this one; their memberships move over and they are deleted. */
  supersedesCardIds?: string[];
};

type ExistingCard = {
  card: CardRow;
  items: { taskId: string; itemHash: string }[];
};

const sourceRanking = ["assignment", "calendar", "email"];

// Unranked entity types sort last; indexOf's -1 would otherwise outrank assignments.
function sourceRank(entityType: string): number {
  const rank = sourceRanking.indexOf(entityType);
  return rank === -1 ? sourceRanking.length : rank;
}

export function pickPrimarySource(items: TaskRow[]): { primarySource: string; sourceUrl: string | null } {
  const sorted = [...items].sort((a, b) => sourceRank(a.sourceEntityType) - sourceRank(b.sourceEntityType));
  const first = sorted[0];
  return { primarySource: first?.source ?? "unknown", sourceUrl: first?.sourceUrl ?? null };
}

const modelName = (process.env.HF_MODEL ?? "openai/gpt-oss-120b:cheapest");

function earliestDue(items: TaskRow[]): Date | null {
  let earliest: Date | null = null;
  for (const item of items) {
    if (!item.dueAt) continue;
    if (!earliest || item.dueAt < earliest) earliest = item.dueAt;
  }
  return earliest;
}

export async function planCards(
  model: LanguageModel | null,
  tasks: TaskRow[],
  existing: ExistingCard[],
  now: Date,
): Promise<CardPlan[]> {
  const existingByTaskId = new Map<string, { cardId: string; itemHash: string }>();
  for (const ec of existing) {
    for (const item of ec.items) {
      existingByTaskId.set(item.taskId, { cardId: ec.card.id, itemHash: item.itemHash });
    }
  }

  const enrichmentModel = model;
  const noModel = model === null;

  const newTasks: TaskRow[] = [];
  const changedTasks: TaskRow[] = [];
  const unchangedTasks: TaskRow[] = [];

  for (const task of tasks) {
    const hash = itemHash(task);
    const existingEntry = existingByTaskId.get(task.id);
    if (!existingEntry) {
      newTasks.push(task);
    } else if (existingEntry.itemHash !== hash) {
      changedTasks.push(task);
    } else {
      unchangedTasks.push(task);
    }
  }

  if (newTasks.length === 0 && changedTasks.length === 0) {
    return [];
  }

  const relevantTasks = [...newTasks, ...changedTasks];

  const maxItems = Math.min(relevantTasks.length, parseInt(process.env.ENRICHMENT_MAX_ITEMS ?? "200", 10));
  const candidates = relevantTasks.slice(0, maxItems);

  const plans: CardPlan[] = [];
  const nonEnriched = maxItems < relevantTasks.length ? relevantTasks.slice(maxItems) : [];

  if (noModel) {
    const fallbackCards = new Map<string, { tasks: TaskRow[]; title: string }>();
    for (const task of candidates) {
      const existingEntry = existingByTaskId.get(task.id);
      const key = existingEntry?.cardId ?? task.id;
      if (!fallbackCards.has(key)) {
        fallbackCards.set(key, { tasks: [], title: task.title });
      }
      fallbackCards.get(key)!.tasks.push(task);
    }
    for (const [, group] of fallbackCards) {
      const tasks = group.tasks;
      const { primarySource, sourceUrl } = pickPrimarySource(tasks);
      const hash = groupHash(tasks.map((t) => itemHash(t)));
      const existingCardId = existingByTaskId.get(tasks[0].id)?.cardId;
      plans.push({
        op: existingCardId ? "update" : "create",
        cardId: existingCardId,
        taskIds: tasks.map((t) => t.id),
        title: group.title,
        summary: null,
        priority: derivePriority(earliestDue(tasks), now),
        dueAt: earliestDue(tasks),
        primarySource,
        sourceUrl,
        inputHash: hash,
        enrichmentStatus: "fallback",
        enrichmentModel: null,
      });
    }
    return plans;
  }

  const triage = await triageItems(enrichmentModel!, candidates);
  const keepTaskIds = new Set(triage.filter((d) => d.keep).map((d) => d.taskId));
  const dropDecisions = triage.filter((d) => !d.keep);

  const keepItems = candidates.filter((t) => keepTaskIds.has(t.id));
  const dropItems = candidates.filter((t) => !keepTaskIds.has(t.id));

  for (const decision of dropDecisions) {
    const task = dropItems.find((t) => t.id === decision.taskId);
    if (!task) continue;
    const existingEntry = existingByTaskId.get(task.id);
    plans.push({
      op: "archive",
      cardId: existingEntry?.cardId,
      taskIds: [task.id],
      title: task.title,
      summary: decision.reason,
      priority: "low",
      dueAt: task.dueAt,
      primarySource: task.source,
      sourceUrl: task.sourceUrl,
      inputHash: itemHash(task),
      enrichmentStatus: "enriched",
      enrichmentModel: modelName,
      archivedReason: decision.reason,
    });
  }

  if (keepItems.length === 0) return plans;

  const candidateIds = new Set(candidates.map((task) => task.id));
  const existingMembers = tasks.filter((task) => existingByTaskId.has(task.id) && !candidateIds.has(task.id));
  const clusters = candidateClusters(keepItems, existingMembers);

  const confirmedGroups: { ref: string; items: TaskRow[] }[] = [];
  const grouped = new Set<string>();
  let refCounter = 0;
  for (const items of await confirmGroups(enrichmentModel!, clusters)) {
    if (items.length === 0) continue;
    confirmedGroups.push({ ref: `h${refCounter++}`, items });
    for (const item of items) grouped.add(item.id);
  }

  for (const item of keepItems) {
    if (grouped.has(item.id)) continue;
    confirmedGroups.push({ ref: `h${refCounter++}`, items: [item] });
  }

  const phraseInput = confirmedGroups.map((g) => ({
    ref: g.ref,
    items: g.items,
  }));
  const phrased = await phraseCards(enrichmentModel!, phraseInput);

  for (const group of confirmedGroups) {
    const card = phrased.get(group.ref);
    const { primarySource, sourceUrl } = pickPrimarySource(group.items);
    const hash = groupHash(group.items.map((t) => itemHash(t)));
    const existingIds = group.items.map((t) => existingByTaskId.get(t.id)?.cardId).filter(Boolean);
    const uniqueExistingIds = [...new Set(existingIds)];

    // A group can span several existing cards once grouping merges them. One card
    // absorbs the group and the rest are superseded, so no task_id is ever claimed
    // by two cards at once.
    const survivors = uniqueExistingIds
      .map((id) => existing.find((ec) => ec.card.id === id))
      .filter((ec): ec is ExistingCard => ec !== undefined);

    if (survivors.length > 0) {
      const [winner, ...superseded] = survivors;
      const allTaskIds = new Set(winner.items.map((i) => i.taskId));
      for (const ec of superseded) for (const i of ec.items) allTaskIds.add(i.taskId);
      for (const t of group.items) allTaskIds.add(t.id);

      plans.push({
        op: "update",
        cardId: winner.card.id,
        taskIds: [...allTaskIds],
        title: card?.title ?? group.items[0].title,
        summary: card?.summary ?? null,
        priority: derivePriority(earliestDue(group.items), now),
        dueAt: earliestDue(group.items),
        primarySource,
        sourceUrl,
        inputHash: hash,
        enrichmentStatus: "enriched",
        enrichmentModel: modelName,
        supersedesCardIds: superseded.map((ec) => ec.card.id),
      });
      continue;
    }

    plans.push({
      op: "create",
      taskIds: group.items.map((t) => t.id),
      title: card?.title ?? group.items[0].title,
      summary: card?.summary ?? null,
      priority: derivePriority(earliestDue(group.items), now),
      dueAt: earliestDue(group.items),
      primarySource,
      sourceUrl,
      inputHash: hash,
      enrichmentStatus: "enriched",
      enrichmentModel: modelName,
    });
  }

  for (const task of nonEnriched) {
    const existingEntry = existingByTaskId.get(task.id);
    const hash = itemHash(task);
    if (existingEntry) {
      plans.push({
        op: "update",
        cardId: existingEntry.cardId,
        taskIds: [task.id],
        title: task.title,
        summary: null,
        priority: derivePriority(task.dueAt, now),
        dueAt: task.dueAt,
        primarySource: task.source,
        sourceUrl: task.sourceUrl,
        inputHash: hash,
        enrichmentStatus: "fallback",
        enrichmentModel: null,
      });
    } else {
      plans.push({
        op: "create",
        taskIds: [task.id],
        title: task.title,
        summary: null,
        priority: derivePriority(task.dueAt, now),
        dueAt: task.dueAt,
        primarySource: task.source,
        sourceUrl: task.sourceUrl,
        inputHash: hash,
        enrichmentStatus: "fallback",
        enrichmentModel: null,
      });
    }
  }

  return plans;
}
