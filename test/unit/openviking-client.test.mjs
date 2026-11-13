import assert from "node:assert/strict";
import test from "node:test";

import { probeOpenViking } from "../../lib/openviking-client.js";

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function connection(overrides = {}) {
  return { url: "http://viking.example", apiKey: "user-secret", account: "personal", user: "alice", ...overrides };
}

test("probes health, readiness and authenticated identity with the stored user key", async () => {
  const calls = [];
  const result = await probeOpenViking(connection(), async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok" });
    if (path === "/ready") return response(200, { status: "ready" });
    return response(200, { result: { account: "personal", user: "alice" } });
  });

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: true, keyRejected: false, identity: { account: "personal", user: "alice" } });
  assert.equal(calls[2].headers.get("Authorization"), "Bearer user-secret");
  assert.equal(calls[2].headers.get("X-OpenViking-Account"), "personal");
  assert.equal(calls[2].headers.get("X-OpenViking-User"), "alice");
});

test("returns the server version reported by /health", async () => {
  const result = await probeOpenViking(connection(), async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok", version: "v0.5.5" });
    if (path === "/ready") return response(200, { status: "ready" });
    return response(200, { result: { account: "personal", user: "alice" } });
  });

  assert.deepEqual(result, {
    reachable: true,
    ready: true,
    authenticated: true,
    keyRejected: false,
    identity: { account: "personal", user: "alice" },
    version: "v0.5.5",
  });
});

test("omits the version when /health does not report one", async () => {
  const result = await probeOpenViking(connection(), async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok" });
    if (path === "/ready") return response(200, { status: "ready" });
    return response(200, { result: { account: "personal", user: "alice" } });
  });

  assert.equal("version" in result, false);
});

test("authenticates liveness and readiness when the server protects them, without tenant headers", async () => {
  const calls = [];
  const result = await probeOpenViking(connection(), async (url, init) => {
    const path = new URL(String(url)).pathname;
    const requestHeaders = new Headers(init?.headers);
    calls.push({ path, headers: requestHeaders });
    const authorized = requestHeaders.get("Authorization") === "Bearer user-secret";
    if (path === "/health") return authorized ? response(200, { status: "ok" }) : response(401, { status: "error" });
    if (path === "/ready") return authorized ? response(200, { status: "ready" }) : response(401, { status: "error" });
    if (path === "/api/v1/system/status") return authorized ? response(200, { result: { account: "personal", user: "alice" } }) : response(401, { status: "error" });
    return response(404, {});
  });

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: true, keyRejected: false, identity: { account: "personal", user: "alice" } });
  assert.deepEqual(calls.map((call) => call.path), ["/health", "/health", "/ready", "/ready", "/api/v1/system/status"]);
  assert.equal(calls[0].headers.get("Authorization"), null);
  assert.equal(calls[1].headers.get("Authorization"), "Bearer user-secret");
  // Trusted mode treats a complete account/user pair as an identity assertion
  // requiring the root key, so the liveness retry must not send it.
  assert.equal(calls[1].headers.get("X-OpenViking-Account"), null);
  assert.equal(calls[1].headers.get("X-OpenViking-User"), null);
  assert.equal(calls[2].headers.get("Authorization"), null);
  assert.equal(calls[3].headers.get("Authorization"), "Bearer user-secret");
  assert.equal(calls[3].headers.get("X-OpenViking-Account"), null);
  assert.equal(calls[4].headers.get("Authorization"), "Bearer user-secret");
  assert.equal(calls[4].headers.get("X-OpenViking-Account"), "personal");
});

test("accepts a successful status response that identifies only the user", async () => {
  const result = await probeOpenViking(connection(), async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok" });
    if (path === "/ready") return response(200, { status: "ready" });
    return response(200, { status: "ok", result: { initialized: true, user: "alice" } });
  });

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: true, keyRejected: false, identity: { account: "", user: "alice" } });
});

test("reports a rejected key as reachable instead of unreachable", async () => {
  const result = await probeOpenViking(connection(), async () => response(401, { status: "error", error: { code: "AuthenticationError" } }));

  assert.deepEqual(result, { reachable: true, ready: false, authenticated: false, keyRejected: true, identity: undefined });
});

test("keeps a rejected key on a self-hosted server distinct from unreadiness", async () => {
  // A self-hosted server answers /health and /ready anonymously but rejects
  // the data-plane key: the user needs a new key, not a readiness check.
  const result = await probeOpenViking(connection(), async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok" });
    if (path === "/ready") return response(200, { status: "ready" });
    return response(401, { status: "error" });
  });

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: false, keyRejected: true, identity: undefined });
});

test("does not retry with authorization when no user key is configured", async () => {
  const calls = [];
  const result = await probeOpenViking(connection({ apiKey: "" }), async (url) => {
    calls.push(String(url));
    return response(401, { status: "error" });
  });

  assert.deepEqual(result, { reachable: true, ready: false, authenticated: false, keyRejected: false, identity: undefined });
  assert.equal(calls.length, 1);
});

test("keeps a non-authentication HTTP error unreachable", async () => {
  const calls = [];
  const result = await probeOpenViking(connection(), async (url) => {
    calls.push(String(url));
    return response(500, { status: "error" });
  });

  assert.deepEqual(result, { reachable: false, ready: false, authenticated: false, keyRejected: false, identity: undefined });
  assert.equal(calls.length, 1);
});

test("reports an unavailable service without calling the authenticated endpoint", async () => {
  const calls = [];
  const result = await probeOpenViking(connection(), async (url) => {
    calls.push(String(url));
    throw new TypeError("network down");
  });

  assert.deepEqual(result, { reachable: false, ready: false, authenticated: false, keyRejected: false, identity: undefined });
  assert.equal(calls.length, 1);
});
