import { jsonb, pgTable, text, timestamp, uuid, integer, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: text("source").notNull(),
  sourceEntityType: text("source_entity_type").notNull(),
  sourceExternalId: text("source_external_id").notNull(),
  connectorId: uuid("connector_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  courseName: text("course_name"),
  sourceUrl: text("source_url"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  upstreamStatus: text("upstream_status"),
  rawData: jsonb("raw_data").notNull().$type<Record<string, unknown>>(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("tasks_source_identity_idx").on(table.source, table.sourceEntityType, table.sourceExternalId),
]);

export const cards = pgTable("cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  summary: text("summary"),
  kanbanStatus: text("kanban_status").notNull().default("backlog"),
  position: integer("position").notNull().default(0),
  priority: text("priority").notNull().default("medium"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  primarySource: text("primary_source").notNull(),
  sourceUrl: text("source_url"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedReason: text("archived_reason"),
  enrichmentStatus: text("enrichment_status").notNull().default("pending"),
  enrichmentModel: text("enrichment_model"),
  inputHash: text("input_hash").notNull(),
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cardItems = pgTable("card_items", {
  cardId: uuid("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  itemHash: text("item_hash").notNull(),
}, (t) => [
  primaryKey({ columns: [t.cardId, t.taskId] }),
  uniqueIndex("card_items_task_idx").on(t.taskId),
]);

export type TaskRow = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type CardRow = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type CardItemRow = typeof cardItems.$inferSelect;
export type NewCardItem = typeof cardItems.$inferInsert;
