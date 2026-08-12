import type { LanguageModel } from "ai";

import type { TaskRow } from "../db/schema.ts";
import { generateOrFallback, mergeSchema } from "./schemas.ts";

const systemPrompt = `You are organizing a student's task board. Given candidate groups of items that may belong together, decide which items should be merged into the same board card.

Each candidate group contains items that the system has already identified as potentially related. For each candidate group:
- Confirm the group as-is if all items are genuinely about the same task or deliverable
- Split the group if some items are unrelated (each subgroup becomes its own card)
- Respond with one or more groups, each containing the refs of items that belong together

Respond with a JSON object containing a "groups" array. Each group has:
- "refs": array of item references (e.g. ["i0", "i1"])

Items with different course names or due dates far apart should not be merged.`;

export async function confirmGroups(
  model: LanguageModel,
  clusters: TaskRow[][],
): Promise<string[][]> {
  if (clusters.length === 0) return [];

  const BATCH_SIZE = 10;
  const result: string[][] = [];

  for (let offset = 0; offset < clusters.length; offset += BATCH_SIZE) {
    const batch = clusters.slice(offset, offset + BATCH_SIZE);
    const refMap = new Map<string, TaskRow>();
    const lines: string[] = [];

    for (let ci = 0; ci < batch.length; ci++) {
      const cluster = batch[ci];
      const clusterRefs: string[] = [];
      for (let ii = 0; ii < cluster.length; ii++) {
        const ref = `c${offset + ci}_i${ii}`;
        refMap.set(ref, cluster[ii]);
        clusterRefs.push(ref);
      }
      lines.push(`Candidate group ${offset + ci}: [${clusterRefs.join(", ")}]`);
      for (const ref of clusterRefs) {
        const item = refMap.get(ref)!;
        lines.push(`  ${ref}: "${item.title}" (course: ${item.courseName ?? "none"}, due: ${item.dueAt ? item.dueAt.toISOString() : "none"})`);
      }
    }

    const prompt = `Review these candidate groups and confirm or split them:\n${lines.join("\n")}`;
    const allRefs = [...refMap.keys()];

    const resp = await generateOrFallback({
      model,
      schema: mergeSchema,
      system: systemPrompt,
      prompt,
      fallback: { groups: allRefs.map((ref) => ({ refs: [ref] })) },
      label: `merge batch ${offset}`,
    });

    const seen = new Set<string>();
    for (const group of resp.value.groups) {
      const validRefs = group.refs.filter((r) => refMap.has(r) && !seen.has(r));
      if (validRefs.length === 0) continue;
      for (const r of validRefs) seen.add(r);
      result.push(validRefs);
    }

    for (const ref of allRefs) {
      if (!seen.has(ref)) {
        result.push([ref]);
      }
    }
  }

  return result;
}
