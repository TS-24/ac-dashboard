CREATE TABLE IF NOT EXISTS "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source" text NOT NULL,
  "source_entity_type" text NOT NULL,
  "source_external_id" text NOT NULL,
  "connector_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "course_name" text,
  "source_url" text,
  "due_at" timestamptz,
  "upstream_status" text,
  "raw_data" jsonb NOT NULL,
  "kanban_status" text DEFAULT 'backlog' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "priority" text DEFAULT 'medium' NOT NULL,
  "archived_at" timestamptz,
  "source_updated_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "tasks_source_identity_idx" ON "tasks" USING btree ("source", "source_entity_type", "source_external_id");
