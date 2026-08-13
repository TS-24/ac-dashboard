import assert from "node:assert/strict";
import { test } from "node:test";

import { MockLanguageModelV4 } from "ai/test";

import type { CardRow, TaskRow } from "../db/schema.ts";
import { pickPrimarySource, planCards } from "./plan.ts";
import { itemHash } from "./hash.ts";

const mockResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined, type: "stop" as const },
  usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
  rawCall: { rawPrompt: "", rawSettings: {} },
  warnings: [] as never[],
  request: {},
});

function makeTask(id: string, overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id, source: "coursework", sourceEntityType: "assignment", sourceExternalId: id,
    connectorId: "c1", title: "Task " + id, description: null, courseName: null,
    sourceUrl: null, dueAt: null, upstreamStatus: null, rawData: {},
    archivedAt: null, sourceUpdatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

const now = new Date("2026-08-12T12:00:00Z");

test("no new or changed items -> zero plans", async () => {
  const model = new MockLanguageModelV4({
    provider: "test", modelId: "test",
    doGenerate: mockResult("{}"),
  });
  const task = makeTask("1");
  const items = [task];
  const hash = itemHash(task);
  const existing = [{
    card: { id: "c1", inputHash: hash } as CardRow,
    items: [{ taskId: "1", itemHash: hash }],
  }];
  const plans = await planCards(model as never, items, existing, now);
  assert.equal(plans.length, 0);
});

test("model: null -> one deterministic fallback plan per item", async () => {
  const items = [makeTask("1"), makeTask("2")];
  const plans = await planCards(null, items, [], now);
  assert.equal(plans.length, 2);
  assert.equal(plans.every((p) => p.enrichmentStatus === "fallback"), true);
});

test("triaged-out item -> archive plan with reason", async () => {
  const model = new MockLanguageModelV4({
    provider: "test", modelId: "test",
    doGenerate: [
      mockResult(JSON.stringify({ decisions: [{ ref: "i0", keep: false, reason: "already graded" }] })),
    ],
  });
  const items = [makeTask("1")];
  const plans = await planCards(model as never, items, [], now);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].op, "archive");
  assert.equal(plans[0].archivedReason, "already graded");
});

test("model: null -> a changed item updates its card instead of creating a duplicate", async () => {
  const task = makeTask("1", { title: "Renamed upstream" });
  const existing = [{
    card: { id: "card-1", inputHash: "stale" } as CardRow,
    items: [{ taskId: "1", itemHash: "stale" }],
  }];

  const plans = await planCards(null, [task], existing, now);

  assert.equal(plans.length, 1);
  assert.equal(plans[0].op, "update");
  assert.equal(plans[0].cardId, "card-1");
});

test("a merge spanning two existing cards updates one instead of creating a third", async () => {
  const a = makeTask("1", { title: "Essay 2 draft", courseName: "PSYC 201" });
  const b = makeTask("2", { title: "Essay 2 final", courseName: "PSYC 201" });
  const existing = [
    { card: { id: "card-a", inputHash: "stale" } as CardRow, items: [{ taskId: "1", itemHash: "stale" }] },
    { card: { id: "card-b", inputHash: "stale" } as CardRow, items: [{ taskId: "2", itemHash: "stale" }] },
  ];

  const model = new MockLanguageModelV4({
    provider: "test", modelId: "test",
    doGenerate: [
      mockResult(JSON.stringify({ decisions: [{ ref: "i0", keep: true, reason: "todo" }, { ref: "i1", keep: true, reason: "todo" }] })),
      mockResult(JSON.stringify({ groups: [{ refs: ["c0_i0", "c0_i1"] }] })),
      mockResult(JSON.stringify({ cards: [{ ref: "h0", title: "Finish Essay 2", summary: "Draft and final" }] })),
    ],
  });

  const plans = await planCards(model as never, [a, b], existing, now);

  assert.equal(plans.length, 1);
  assert.equal(plans[0].op, "update");
  assert.ok(["card-a", "card-b"].includes(plans[0].cardId ?? ""));
  assert.deepEqual([...plans[0].taskIds].sort(), ["1", "2"]);
  assert.deepEqual(plans[0].supersedesCardIds, [plans[0].cardId === "card-a" ? "card-b" : "card-a"]);
});

test("primary source prefers assignments over unranked entity types", () => {
  const unknown = makeTask("1", { sourceEntityType: "announcement", source: "noise", sourceUrl: "https://noise" });
  const assignment = makeTask("2", { sourceEntityType: "assignment", source: "coursework", sourceUrl: "https://coursework" });

  assert.deepEqual(pickPrimarySource([unknown, assignment]), {
    primarySource: "coursework",
    sourceUrl: "https://coursework",
  });
});

test("model error at any stage -> still produces a plan for each item", async () => {
  const model = new MockLanguageModelV4({
    provider: "test", modelId: "test",
    doGenerate: async () => { throw new Error("API error"); },
  });
  const items = [makeTask("1")];
  const plans = await planCards(model as never, items, [], now);
  assert.equal(plans.length, 1);
});
