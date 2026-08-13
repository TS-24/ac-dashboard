import assert from "node:assert/strict";
import { test } from "node:test";

import { PksApiClient, type Connector } from "./pks-api.ts";

test("lists connectors with authentication and pagination", async () => {
  const response: Connector[] = [];
  let request: Request | undefined;

  const client = new PksApiClient({
    baseUrl: "http://localhost:8001/api/v1/",
    apiKey: "pks_test-key",
    fetch: async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ items: response, total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await client.connectors.list({ limit: 20, offset: 40 });

  assert.deepEqual(result, { items: response, total: 0 });
  assert.equal(request?.url, "http://localhost:8001/api/v1/connectors?limit=20&offset=40");
  assert.equal(request?.headers.get("X-API-Key"), "pks_test-key");
});

test("creates a key without sending an API key", async () => {
  let request: Request | undefined;
  const client = new PksApiClient({
    baseUrl: "http://localhost:8001/api/v1",
    apiKey: "pks_existing-key",
    fetch: async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ key: "pks_new-key" }), { status: 201 });
    },
  });

  await client.auth.createKey({ name: "dashboard" });

  assert.equal(request?.url, "http://localhost:8001/api/v1/auth/keys");
  assert.equal(request?.headers.get("X-API-Key"), null);
  assert.equal(request?.headers.get("Content-Type"), "application/json");
  assert.deepEqual(await request?.json(), { name: "dashboard" });
});

test("surfaces the API error envelope", async () => {
  const client = new PksApiClient({
    baseUrl: "http://localhost:8001/api/v1",
    apiKey: "pks_test-key",
    fetch: async () =>
      new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Missing" } }), {
        status: 404,
      }),
  });

  await assert.rejects(() => client.events.get("missing"), {
    name: "PksApiError",
    message: "Missing",
  });
});
