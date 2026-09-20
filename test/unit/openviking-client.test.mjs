import assert from "node:assert/strict";
import test from "node:test";

import { probeOpenViking } from "../../lib/openviking-client.js";

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("probes health, readiness and authenticated identity with the stored user key", async () => {
  const calls = [];
  const result = await probeOpenViking(
    { url: "http://viking.example", apiKey: "user-secret", account: "personal", user: "alice" },
    async (url, init) => {
      calls.push({ url: String(url), headers: new Headers(init?.headers) });
      const path = new URL(String(url)).pathname;
      if (path === "/health") return response(200, { status: "ok" });
      if (path === "/ready") return response(200, { status: "ready" });
      return response(200, { result: { account: "personal", user: "alice" } });
    },
  );

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: true, identity: { account: "personal", user: "alice" } });
  assert.equal(calls[2].headers.get("Authorization"), "Bearer user-secret");
  assert.equal(calls[2].headers.get("X-OpenViking-Account"), "personal");
  assert.equal(calls[2].headers.get("X-OpenViking-User"), "alice");
});

test("accepts a successful status response that identifies only the user", async () => {
  const result = await probeOpenViking(
    { url: "http://viking.example", apiKey: "user-secret", account: "personal", user: "alice" },
    async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/health") return response(200, { status: "ok" });
      if (path === "/ready") return response(200, { status: "ready" });
      return response(200, { status: "ok", result: { initialized: true, user: "alice" } });
    },
  );

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: true, identity: { account: "", user: "alice" } });
});

test("reports an unavailable service without calling the authenticated endpoint", async () => {
  const calls = [];
  const result = await probeOpenViking(
    { url: "http://viking.example", apiKey: "user-secret", account: "personal", user: "alice" },
    async (url) => {
      calls.push(String(url));
      throw new TypeError("network down");
    },
  );

  assert.deepEqual(result, { reachable: false, ready: false, authenticated: false, identity: undefined });
  assert.equal(calls.length, 1);
});
