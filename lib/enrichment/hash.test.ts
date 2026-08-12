import assert from "node:assert/strict";
import { test } from "node:test";

import { itemHash, groupHash } from "./hash.ts";

test("same content -> same hash", () => {
  const a = itemHash({ title: "Essay 2", description: "Write it", courseName: "PSYC 201", dueAt: new Date("2026-08-20T23:59:00Z"), upstreamStatus: "not submitted" });
  const b = itemHash({ title: "Essay 2", description: "Write it", courseName: "PSYC 201", dueAt: new Date("2026-08-20T23:59:00Z"), upstreamStatus: "not submitted" });
  assert.equal(a, b);
});

test("changed dueAt -> different hash", () => {
  const a = itemHash({ title: "Essay 2", description: "Write it", courseName: "PSYC 201", dueAt: new Date("2026-08-20T23:59:00Z"), upstreamStatus: "not submitted" });
  const b = itemHash({ title: "Essay 2", description: "Write it", courseName: "PSYC 201", dueAt: new Date("2026-08-21T23:59:00Z"), upstreamStatus: "not submitted" });
  assert.notEqual(a, b);
});

test("groupHash is order-independent", () => {
  const h1 = groupHash(["a", "b", "c"]);
  const h2 = groupHash(["c", "a", "b"]);
  assert.equal(h1, h2);
});

test("itemHash handles null fields", () => {
  const h = itemHash({ title: "Task", description: null, courseName: null, dueAt: null, upstreamStatus: null });
  assert.equal(typeof h, "string");
  assert.equal(h.length, 64);
});
