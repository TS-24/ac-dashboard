import assert from "node:assert/strict";
import { test } from "node:test";

import { MockLanguageModelV4 } from "ai/test";

import type { TaskRow } from "../db/schema.ts";
import { triageItems } from "./triage.ts";

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

test("mock returns two drops -> those decisions", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: mockResult(JSON.stringify({ decisions: [{ ref: "i0", keep: false, reason: "announcement" }, { ref: "i1", keep: true, reason: "needs submission" }] })),
  });

  const items = [makeTask("a"), makeTask("b")];
  const decisions = await triageItems(model as never, items);

  assert.equal(decisions.length, 2);
  assert.equal(decisions.find((d) => d.taskId === "a")?.keep, false);
  assert.equal(decisions.find((d) => d.taskId === "a")?.reason, "announcement");
  assert.equal(decisions.find((d) => d.taskId === "b")?.keep, true);
});

test("mock omits an item -> that item defaults to keep", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: mockResult(JSON.stringify({ decisions: [{ ref: "i0", keep: true, reason: "needs work" }] })),
  });

  const items = [makeTask("a"), makeTask("b")];
  const decisions = await triageItems(model as never, items);

  assert.equal(decisions.length, 2);
  assert.equal(decisions.find((d) => d.taskId === "a")?.keep, true);
  assert.equal(decisions.find((d) => d.taskId === "b")?.keep, true);
});

test("model throws -> all keep", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: async () => { throw new Error("API error"); },
  });

  const items = [makeTask("a"), makeTask("b")];
  const decisions = await triageItems(model as never, items);

  assert.equal(decisions.length, 2);
  assert.equal(decisions.every((d) => d.keep), true);
});
