import assert from "node:assert/strict";
import { test } from "node:test";

import type { TaskRow } from "../db/schema.ts";
import { candidateClusters } from "./group.ts";

function makeTask(overrides: Partial<TaskRow> & { id: string; title: string }): TaskRow {
  return {
    source: "coursework",
    sourceEntityType: "assignment",
    sourceExternalId: overrides.id,
    connectorId: "c1",
    description: null,
    courseName: null,
    sourceUrl: null,
    dueAt: null,
    upstreamStatus: null,
    rawData: {},
    archivedAt: null,
    sourceUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

test("two titles for the same essay in one course cluster", () => {
  const items = [
    makeTask({ id: "1", title: "Essay 2 First Draft", courseName: "PSYC 201", dueAt: new Date("2026-08-20T23:59:00Z") }),
    makeTask({ id: "2", title: "Final Draft Essay 2", courseName: "PSYC 201", dueAt: new Date("2026-08-22T23:59:00Z") }),
  ];
  const clusters = candidateClusters(items);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].length, 2);
});

test("same title in different courses do not cluster", () => {
  const items = [
    makeTask({ id: "1", title: "Reading Response", courseName: "PSYC 201", dueAt: new Date("2026-08-20T23:59:00Z") }),
    makeTask({ id: "2", title: "Reading Response", courseName: "MATH 101", dueAt: new Date("2026-08-21T23:59:00Z") }),
  ];
  const clusters = candidateClusters(items);
  assert.equal(clusters.length, 2);
});

test("due dates 5 days apart do not cluster", () => {
  const items = [
    makeTask({ id: "1", title: "Lab Report", courseName: "CHEM 101", dueAt: new Date("2026-08-15T23:59:00Z") }),
    makeTask({ id: "2", title: "Lab Report", courseName: "CHEM 101", dueAt: new Date("2026-08-20T23:59:00Z") }),
  ];
  const clusters = candidateClusters(items);
  assert.equal(clusters.length, 2);
});

test("cluster caps at 5 members", () => {
  const items = Array.from({ length: 7 }, (_, i) =>
    makeTask({ id: String(i), title: "Same Task Batch", courseName: "BIO 101", dueAt: new Date("2026-08-20T23:59:00Z") }),
  );
  const clusters = candidateClusters(items);
  const maxSize = Math.max(...clusters.map((c) => c.length));
  assert.equal(maxSize, 5);
});

test("existing card member pulls a new item into its cluster", () => {
  const items = [
    makeTask({ id: "1", title: "Homework 4", courseName: "CS 101", dueAt: new Date("2026-08-20T23:59:00Z") }),
  ];
  const existingMembers = [{ taskId: "1" }];
  const clusters = candidateClusters(items, existingMembers);
  assert.equal(clusters.length, 1);
});
