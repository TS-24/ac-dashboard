import assert from "node:assert/strict";
import { test } from "node:test";

import { MockLanguageModelV4 } from "ai/test";

import type { TaskRow } from "../db/schema.ts";
import { phraseCards } from "./phrase.ts";

const mockResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined, type: "stop" as const },
  usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
  rawCall: { rawPrompt: "", rawSettings: {} },
  warnings: [] as never[],
  request: {},
});

function makeTask(id: string, title: string, overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id, source: "coursework", sourceEntityType: "assignment", sourceExternalId: id,
    connectorId: "c1", title, description: null, courseName: "Test Course",
    sourceUrl: null, dueAt: null, upstreamStatus: null, rawData: {},
    archivedAt: null, sourceUpdatedAt: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

test("mock returns titles -> mapped by ref", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: mockResult(JSON.stringify({ cards: [{ ref: "g0", title: "Write Essay 2", summary: "Complete the analysis for PSYC 201" }] })),
  });

  const groups = [{ ref: "g0", items: [makeTask("1", "Essay 2")] }];
  const result = await phraseCards(model as never, groups);

  assert.equal(result.get("g0")?.title, "Write Essay 2");
  assert.equal(result.get("g0")?.summary, "Complete the analysis for PSYC 201");
});

test("missing ref -> upstream title fallback", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: mockResult(JSON.stringify({ cards: [{ ref: "g1", title: "Some other card", summary: "" }] })),
  });

  const groups = [{ ref: "g0", items: [makeTask("1", "Original Title")] }];
  const result = await phraseCards(model as never, groups);

  assert.equal(result.get("g0")?.title, "Original Title");
});
