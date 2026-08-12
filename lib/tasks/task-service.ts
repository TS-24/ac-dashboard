import { and, asc, eq } from "drizzle-orm";

import { db } from "../db/client.ts";
import { tasks, type TaskRow } from "../db/schema.ts";
import { type AssignmentTaskInput } from "./task-mapper.ts";

export type TaskStatus = "backlog" | "in_progress" | "review" | "done";
export type TaskPriority = "high" | "medium" | "low";

function requireDb() {
  if (!db) throw new Error("DATABASE_URL is required");
  return db;
}

export async function listTasks(): Promise<TaskRow[]> {
  return requireDb().select().from(tasks).orderBy(asc(tasks.createdAt));
}

export async function updateTask(taskId: string, input: { priority?: TaskPriority }): Promise<TaskRow | null> {
  const [task] = await requireDb().update(tasks).set({ ...input, updatedAt: new Date() }).where(eq(tasks.id, taskId)).returning();
  return task ?? null;
}

export async function upsertAssignment(input: AssignmentTaskInput): Promise<"created" | "updated" | "unchanged"> {
  const database = requireDb();
  const existing = await database.select().from(tasks).where(and(eq(tasks.source, input.source), eq(tasks.sourceEntityType, input.sourceEntityType), eq(tasks.sourceExternalId, input.sourceExternalId))).limit(1);
  const current = existing[0];
  if (!current) {
    await database.insert(tasks).values(input);
    return "created";
  }

  const changed = current.title !== input.title || current.description !== input.description || current.courseName !== input.courseName || current.sourceUrl !== input.sourceUrl || current.dueAt?.getTime() !== input.dueAt?.getTime() || current.upstreamStatus !== input.upstreamStatus || JSON.stringify(current.rawData) !== JSON.stringify(input.rawData);
  if (!changed) return "unchanged";

  await database.update(tasks).set({ ...input, updatedAt: new Date() }).where(eq(tasks.id, current.id));
  return "updated";
}
