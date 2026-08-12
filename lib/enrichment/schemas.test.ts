import assert from "node:assert/strict";
import { test } from "node:test";

import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

import { generateOrFallback } from "./schemas.ts";

const mockResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined, type: "stop" as const },
  usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
  rawCall: { rawPrompt: "", rawSettings: {} },
  warnings: [] as never[],
  request: {},
});

const testSchema = z.object({ result: z.string() });

test("valid JSON parses", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: mockResult(JSON.stringify({ result: "hello" })),
  });
  const res = await generateOrFallback({
    model: model as never,
    schema: testSchema,
    system: "",
    prompt: "",
    fallback: { result: "fallback" },
    label: "test",
  });
  assert.equal(res.ok, true);
  assert.equal(res.value.result, "hello");
});

test("fenced json parses via repairText", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: mockResult("```json\n{\"result\": \"world\"}\n```"),
  });
  const res = await generateOrFallback({
    model: model as never,
    schema: testSchema,
    system: "",
    prompt: "",
    fallback: { result: "fallback" },
    label: "test",
  });
  assert.equal(res.ok, true);
  assert.equal(res.value.result, "world");
});

test("JSON with trailing prose parses via repairText", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: mockResult('{"result": "hello"} some trailing text'),
  });
  const res = await generateOrFallback({
    model: model as never,
    schema: testSchema,
    system: "",
    prompt: "",
    fallback: { result: "fallback" },
    label: "test",
  });
  assert.equal(res.ok, true);
  assert.equal(res.value.result, "hello");
});

test("garbage returns the fallback with ok: false", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: mockResult("not even close to JSON"),
  });
  const res = await generateOrFallback({
    model: model as never,
    schema: testSchema,
    system: "",
    prompt: "",
    fallback: { result: "fallback" },
    label: "test",
  });
  assert.equal(res.ok, false);
  assert.equal(res.value.result, "fallback");
});

test("a rejected promise returns the fallback rather than throwing", async () => {
  const model = new MockLanguageModelV4({
    provider: "test",
    modelId: "test",
    doGenerate: async () => { throw new Error("network error"); },
  });
  const res = await generateOrFallback({
    model: model as never,
    schema: testSchema,
    system: "",
    prompt: "",
    fallback: { result: "fallback" },
    label: "test",
  });
  assert.equal(res.ok, false);
  assert.equal(res.value.result, "fallback");
});
