import assert from "node:assert/strict";
import { test } from "node:test";

import { mapAssignmentSnapshot } from "./task-mapper.ts";

const snapshot = {
  id: "snapshot-1",
  connector_id: "connector-1",
  entity_type: "assignment",
  external_id: "assignment-1",
  data: {
    title: "Essay 2",
    course_name: "PSYC 201",
    due_date: "2026-08-20T23:59:00Z",
    status: "not submitted",
    description: "Write the analysis.",
    url: "https://example.com/essay-2",
  },
  version: 3,
  updated_at: "2026-08-12T12:00:00Z",
};

test("maps an assignment snapshot into a durable task", () => {
  const task = mapAssignmentSnapshot(snapshot, "coursework");

  assert.deepEqual(task, {
    source: "coursework",
    sourceEntityType: "assignment",
    sourceExternalId: "assignment-1",
    connectorId: "connector-1",
    title: "Essay 2",
    description: "Write the analysis.",
    courseName: "PSYC 201",
    sourceUrl: "https://example.com/essay-2",
    dueAt: new Date("2026-08-20T23:59:00Z"),
    upstreamStatus: "not submitted",
    rawData: snapshot.data,
    sourceUpdatedAt: new Date("2026-08-12T12:00:00Z"),
  });
});

test("uses safe defaults for optional assignment fields", () => {
  const task = mapAssignmentSnapshot({ ...snapshot, data: { title: "Untitled" } }, "coursework");

  assert.equal(task.title, "Untitled");
  assert.equal(task.description, null);
  assert.equal(task.courseName, null);
  assert.equal(task.sourceUrl, null);
  assert.equal(task.dueAt, null);
  assert.equal(task.upstreamStatus, null);
});

test("rejects non-assignment snapshots", () => {
  assert.throws(() => mapAssignmentSnapshot({ ...snapshot, entity_type: "email" }, "gmail"), /assignment/);
});
