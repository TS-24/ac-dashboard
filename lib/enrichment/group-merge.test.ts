import assert from "node:assert/strict";
import { test } from "node:test";

import { MockLanguageModelV4 } from "ai/test";

import type { TaskRow } from "../db/schema.ts";
import { confirmGroups } from "./group-merge.ts";

const mockResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined, type: "stop" as const },
  usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
  rawCall: { rawPrompt: "", rawSettings: {} },
  warnings: [] as never[],
  request: {},
});

function makeTask(id: string, title: string): TaskRow {
  return {
    id, source: "coursework", sourceEntityType: "assignment", sourceExternalId: id,
    connectorId: "c1", title, description: null, courseName: null,
    sourceUrl: null, dueAt: null, upstreamStatus: null, rawData: {},
    archivedAt: null, sourceUpdatedAt: null, createdAt: new Date(), updatedAt: new Date(),
  };
}

test("refs resolve to their own cluster, not the first one", async () => {
  const clusterA = [makeTask("a0", "Alpha draft"), makeTask("a1", "Alpha final")];
  const clusterB = [makeTask("b0", "Beta draft"), makeTask("b1", "Beta final")];

  const model = new MockLanguageModelV4({
    provider: "test", modelId: "test",
    doGenerate: mockResult(JSON.stringify({
      groups: [{ refs: ["c1_i0", "c1_i1"] }, { refs: ["c0_i0"] }, { refs: ["c0_i1"] }],
    })),
  });

  const groups = await confirmGroups(model as never, [clusterA, clusterB]);
  const merged = groups.find((group) => group.length === 2);

  assert.ok(merged, "expected the confirmed pair to survive");
  assert.deepEqual(merged.map((task) => task.id).sort(), ["b0", "b1"]);
});

test("unreferenced items fall back to singletons", async () => {
  const cluster = [makeTask("x", "One"), makeTask("y", "Two")];
  const model = new MockLanguageModelV4({
    provider: "test", modelId: "test",
    doGenerate: mockResult(JSON.stringify({ groups: [{ refs: ["c0_i0"] }] })),
  });

  const groups = await confirmGroups(model as never, [cluster]);
  assert.deepEqual(groups.map((group) => group.map((task) => task.id)).sort(), [["x"], ["y"]]);
});

test("a model error splits every cluster into singletons", async () => {
  const cluster = [makeTask("x", "One"), makeTask("y", "Two")];
  const model = new MockLanguageModelV4({
    provider: "test", modelId: "test",
    doGenerate: async () => { throw new Error("API error"); },
  });

  const groups = await confirmGroups(model as never, [cluster]);
  assert.equal(groups.length, 2);
  assert.equal(groups.every((group) => group.length === 1), true);
});
