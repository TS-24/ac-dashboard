import assert from "node:assert/strict";
import { test } from "node:test";

import { mapAssignmentSnapshot } from "./task-mapper.ts";

test("assignment mapping preserves user-owned fields as a separate concern", () => {
  const mapped = mapAssignmentSnapshot({ id: "s", connector_id: "00000000-0000-0000-0000-000000000001", entity_type: "assignment", external_id: "a", data: { title: "Task" }, version: 1, updated_at: null }, "source");

  assert.equal(mapped.sourceExternalId, "a");
  assert.equal(mapped.title, "Task");
  assert.equal("kanbanStatus" in mapped, false);
});
