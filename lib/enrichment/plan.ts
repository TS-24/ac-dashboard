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
};

type ExistingCard = {
  card: CardRow;
  items: { taskId: string; itemHash: string }[];
};

function pickPrimarySource(items: TaskRow[]): { primarySource: string; sourceUrl: string | null } {
  const ranked = ["assignment", "calendar", "email"];
  const sorted = [...items].sort((a, b) => ranked.indexOf(a.sourceEntityType) - ranked.indexOf(b.sourceEntityType));
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
      itemHash(task);
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
      plans.push({
        op: "create",
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

  const existingMemberIds = existing.flatMap((ec) => ec.items.map((i) => ({ taskId: i.taskId })));
  const clusters = candidateClusters(keepItems, existingMemberIds);

  const refdClusters: { ref: string; items: TaskRow[] }[] = clusters.map((cluster, i) => ({
    ref: `g${i}`,
    items: cluster,
  }));

  const confirmedStringGroups = await confirmGroups(enrichmentModel!, clusters);

  const confirmedGroups: { ref: string; items: TaskRow[] }[] = [];
  const stringToRef = new Map<string, string>();
  let refCounter = 0;
  for (const stringGroup of confirmedStringGroups) {
    const items = stringGroup
      .map((ref) => {
        for (const rc of refdClusters) {
          const found = rc.items.find((item) => ref.endsWith(`_i${rc.items.indexOf(item)}`));
          if (found) return found;
        }
        return undefined;
      })
      .filter((item): item is TaskRow => item !== undefined);
    if (items.length === 0) continue;
    const ref = `h${refCounter++}`;
    confirmedGroups.push({ ref, items });
    for (const item of items) {
      stringToRef.set(item.id, ref);
    }
  }

  const singletons = keepItems.filter((item) => !stringToRef.has(item.id));
  for (const item of singletons) {
    const ref = `h${refCounter++}`;
    confirmedGroups.push({ ref, items: [item] });
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

    if (uniqueExistingIds.length === 1) {
      const existingCard = existing.find((ec) => ec.card.id === uniqueExistingIds[0]);
      if (existingCard) {
        const allTaskIds = new Set(existingCard.items.map((i) => i.taskId));
        for (const t of group.items) allTaskIds.add(t.id);
        plans.push({
          op: "update",
          cardId: existingCard.card.id,
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
        });
        continue;
      }
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
