import type { LanguageModel } from "ai";

import type { TaskRow } from "../db/schema.ts";
import { generateOrFallback, triageSchema } from "./schemas.ts";

export type TriageDecision = { taskId: string; keep: boolean; reason: string };

const systemPrompt = `You are a student triaging their personal task board. For each item, decide whether it needs an action from the student.

Keep items that:
- Are assignments, projects, essays, or homework with a deadline
- Require the student to submit, write, prepare, or respond
- Have a "not submitted" or "pending" status

Drop items that:
- Are announcements, syllabi, reading lists, or reference materials
- Have already been submitted and graded
- Are duplicate reminders of the same thing
- Are purely informational with no action required

Respond with a JSON object containing a "decisions" array. Each decision has:
- "ref": the item reference (e.g. "i0", "i1")
- "keep": true if the item belongs on the board, false otherwise
- "reason": a very brief explanation (max 120 chars)`;

export async function triageItems(model: LanguageModel, items: TaskRow[]): Promise<TriageDecision[]> {
  if (items.length === 0) return [];

  const BATCH_SIZE = 20;
  const decisions: TriageDecision[] = [];

  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const batch = items.slice(offset, offset + BATCH_SIZE);
    const refMap = new Map<string, string>();
    const lines: string[] = [];

    for (let i = 0; i < batch.length; i++) {
      const ref = `i${offset + i}`;
      refMap.set(ref, batch[i].id);
      const item = batch[i];
      lines.push(`${ref}: "${item.title}" (course: ${item.courseName ?? "none"}, status: ${item.upstreamStatus ?? "unknown"}, due: ${item.dueAt ? item.dueAt.toISOString() : "none"})`);
    }

    const prompt = `Triage these items:\n${lines.join("\n")}`;

    const result = await generateOrFallback({
      model,
      schema: triageSchema,
      system: systemPrompt,
      prompt,
      fallback: { decisions: batch.map((item, i) => ({ ref: `i${offset + i}`, keep: true, reason: "fallback" })) },
      label: `triage batch ${offset}`,
    });

    const seen = new Set<string>();
    for (const d of result.value.decisions) {
      const taskId = refMap.get(d.ref);
      if (!taskId || seen.has(taskId)) continue;
      seen.add(taskId);
      decisions.push({ taskId, keep: d.keep, reason: d.reason });
    }

    for (const item of batch) {
      if (!seen.has(item.id)) {
        decisions.push({ taskId: item.id, keep: true, reason: "default keep" });
      }
    }
  }

  return decisions;
}
