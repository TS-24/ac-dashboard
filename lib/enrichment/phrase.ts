import type { LanguageModel } from "ai";

import type { TaskRow } from "../db/schema.ts";
import { generateOrFallback, phraseSchema } from "./schemas.ts";

const systemPrompt = `You are writing board card titles for a student's task dashboard. Given a group of items that belong to the same task, produce a clear, actionable title and a one-line summary.

Rules:
- Title must be an imperative or clear noun phrase describing the concrete deliverable (max 80 characters)
- Summary must be one line explaining what needs to be done (max 140 characters)
- Do not invent a due date or course name that is not in the input
- If the items are clearly about the same thing, write one title that covers them all

Respond with a JSON object containing a "cards" array. Each card has:
- "ref": the group reference (e.g. "g0", "g1")
- "title": the card title (3-80 chars)
- "summary": brief summary (max 140 chars)`;

export async function phraseCards(
  model: LanguageModel,
  groups: { ref: string; items: TaskRow[] }[],
): Promise<Map<string, { title: string; summary: string }>> {
  if (groups.length === 0) return new Map();

  const BATCH_SIZE = 10;
  const result = new Map<string, { title: string; summary: string }>();

  for (let offset = 0; offset < groups.length; offset += BATCH_SIZE) {
    const batch = groups.slice(offset, offset + BATCH_SIZE);
    const lines: string[] = [];

    for (const group of batch) {
      lines.push(`Group ${group.ref}:`);
      for (const item of group.items) {
        lines.push(`  "${item.title}" (course: ${item.courseName ?? "none"})`);
      }
    }

    const prompt = `Write card titles for these groups:\n${lines.join("\n")}`;

    const resp = await generateOrFallback({
      model,
      schema: phraseSchema,
      system: systemPrompt,
      prompt,
      fallback: { cards: batch.map((g) => ({ ref: g.ref, title: g.items[0]?.title ?? "Untitled", summary: "" })) },
      label: `phrase batch ${offset}`,
    });

    for (const card of resp.value.cards) {
      const group = batch.find((g) => g.ref === card.ref);
      if (!group) continue;
      result.set(card.ref, { title: card.title, summary: card.summary });
    }

    for (const group of batch) {
      if (!result.has(group.ref)) {
        result.set(group.ref, { title: group.items[0]?.title ?? "Untitled", summary: "" });
      }
    }
  }

  return result;
}
