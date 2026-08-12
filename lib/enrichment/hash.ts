import { createHash } from "node:crypto";

import type { TaskRow } from "../db/schema.ts";

export function itemHash(task: Pick<TaskRow, "title" | "description" | "courseName" | "dueAt" | "upstreamStatus">): string {
  return createHash("sha256")
    .update(task.title ?? "")
    .update("\0")
    .update(task.description ?? "")
    .update("\0")
    .update(task.courseName ?? "")
    .update("\0")
    .update(task.dueAt ? task.dueAt.toISOString() : "")
    .update("\0")
    .update(task.upstreamStatus ?? "")
    .digest("hex");
}

export function groupHash(hashes: string[]): string {
  return createHash("sha256")
    .update([...hashes].sort().join("\0"))
    .digest("hex");
}
