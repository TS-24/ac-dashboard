import assert from "node:assert/strict";
import { test } from "node:test";

import { derivePriority } from "./priority.ts";

test("overdue -> high", () => {
  assert.equal(derivePriority(new Date("2026-08-10T12:00:00Z"), new Date("2026-08-12T12:00:00Z")), "high");
});

test("due within 24h -> high", () => {
  assert.equal(derivePriority(new Date("2026-08-13T06:00:00Z"), new Date("2026-08-12T12:00:00Z")), "high");
});

test("due within 72h -> medium", () => {
  assert.equal(derivePriority(new Date("2026-08-15T06:00:00Z"), new Date("2026-08-12T12:00:00Z")), "medium");
});

test("due beyond 72h -> low", () => {
  assert.equal(derivePriority(new Date("2026-08-20T12:00:00Z"), new Date("2026-08-12T12:00:00Z")), "low");
});

test("null due -> low", () => {
  assert.equal(derivePriority(null, new Date()), "low");
});

test("boundary at exactly 24h", () => {
  assert.equal(derivePriority(new Date("2026-08-13T12:00:00Z"), new Date("2026-08-12T12:00:00Z")), "high");
});

test("boundary at exactly 72h", () => {
  assert.equal(derivePriority(new Date("2026-08-15T12:00:00Z"), new Date("2026-08-12T12:00:00Z")), "medium");
});
