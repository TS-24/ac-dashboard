DO $$
DECLARE
  task RECORD;
  card_id uuid;
BEGIN

CREATE TABLE IF NOT EXISTS "cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "kanban_status" text DEFAULT 'backlog' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "priority" text DEFAULT 'medium' NOT NULL,
  "due_at" timestamptz,
  "primary_source" text NOT NULL,
  "source_url" text,
  "archived_at" timestamptz,
  "archived_reason" text,
  "enrichment_status" text DEFAULT 'pending' NOT NULL,
  "enrichment_model" text,
  "input_hash" text NOT NULL,
  "enriched_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "card_items" (
  "card_id" uuid NOT NULL REFERENCES "cards"(id) ON DELETE CASCADE,
  "task_id" uuid NOT NULL REFERENCES "tasks"(id) ON DELETE CASCADE,
  "item_hash" text NOT NULL,
  PRIMARY KEY ("card_id", "task_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "card_items_task_idx" ON "card_items" USING btree ("task_id");

FOR task IN SELECT * FROM "tasks" LOOP
  card_id := gen_random_uuid();
  INSERT INTO "cards" ("id", "title", "summary", "kanban_status", "position", "priority", "due_at", "primary_source", "source_url", "enrichment_status", "input_hash", "created_at", "updated_at")
  VALUES (card_id, task.title, NULL, task.kanban_status, task.position, task.priority, task.due_at, task.source, task.source_url, 'pending', '', task.created_at, task.updated_at);
  INSERT INTO "card_items" ("card_id", "task_id", "item_hash")
  VALUES (card_id, task.id, '');
END LOOP;

ALTER TABLE "tasks" DROP COLUMN IF EXISTS "kanban_status";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "position";
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "priority";

END $$;
