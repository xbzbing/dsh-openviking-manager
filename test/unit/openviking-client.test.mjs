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

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: true, keyRejected: false, keyMissing: false, identity: { account: "personal", user: "alice" } });
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
    keyMissing: false,
    identity: { account: "personal", user: "alice" },
    version: "v0.5.5",
  });
});

test("keeps the version when the probe stops before the authenticated status call", async () => {
  // No user key: the probe never calls /status, but the version came from the
  // successful /health answer, so the badge still reflects the server.
  const result = await probeOpenViking(connection({ apiKey: "" }), async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok", version: "v0.5.5" });
    return response(200, { status: "ready" });
  });

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: false, keyRejected: false, keyMissing: true, identity: undefined, version: "v0.5.5" });
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

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: true, keyRejected: false, keyMissing: false, identity: { account: "personal", user: "alice" } });
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

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: true, keyRejected: false, keyMissing: false, identity: { account: "", user: "alice" } });
});

for (const status of [401, 403]) {
  test(`reports a ${status} authentication challenge as reachable instead of unreachable`, async () => {
    const result = await probeOpenViking(connection(), async () => response(status, { status: "error", error: { code: "AuthenticationError" } }));

    assert.deepEqual(result, { reachable: true, ready: false, authenticated: false, keyRejected: true, keyMissing: false, identity: undefined });
  });
}

test("keeps a rejected key on a self-hosted server distinct from unreadiness", async () => {
  // A self-hosted server answers /health and /ready anonymously but rejects
  // the data-plane key: the user needs a new key, not a readiness check.
  const result = await probeOpenViking(connection(), async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok" });
    if (path === "/ready") return response(200, { status: "ready" });
    return response(401, { status: "error" });
  });

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: false, keyRejected: true, keyMissing: false, identity: undefined });
});

test("reports a missing key when the endpoint itself requires authentication", async () => {
  const calls = [];
  const result = await probeOpenViking(connection({ apiKey: "" }), async (url) => {
    calls.push(String(url));
    return response(401, { status: "error" });
  });

  assert.deepEqual(result, { reachable: true, ready: false, authenticated: false, keyRejected: false, keyMissing: true, identity: undefined });
  assert.equal(calls.length, 1);
});

test("reports a missing key when health and readiness answer anonymously", async () => {
  // Both endpoints are open, so the probe stops before /status: it has no key
  // to send there. The 401 branch of the status request is unreachable here.
  const calls = [];
  const result = await probeOpenViking(connection({ apiKey: "" }), async (url) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    if (path === "/health") return response(200, { status: "ok" });
    if (path === "/ready") return response(200, { status: "ready" });
    return response(401, { status: "error" });
  });

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: false, keyRejected: false, keyMissing: true, identity: undefined });
  assert.deepEqual(calls, ["/health", "/ready"]);
});

test("keeps the connection when readiness rejects the key but status accepts it", async () => {
  // A hosted gateway may not expose /ready to user keys. A successful status
  // response is the authoritative authentication result; readiness becomes a
  // warning instead of failing the whole verification.
  const calls = [];
  const result = await probeOpenViking(connection(), async (url, init) => {
    const path = new URL(String(url)).pathname;
    const authorized = new Headers(init?.headers).get("Authorization") === "Bearer user-secret";
    calls.push({ path, authorized });
    if (path === "/health") return authorized ? response(200, { status: "ok" }) : response(401, { status: "error" });
    if (path === "/ready") return response(401, { status: "error" });
    if (path === "/api/v1/system/status") return authorized ? response(200, { result: { account: "personal", user: "alice" } }) : response(401, { status: "error" });
    return response(404, {});
  });

  assert.deepEqual(result, { reachable: true, ready: false, authenticated: true, keyRejected: false, keyMissing: false, identity: { account: "personal", user: "alice" } });
  assert.deepEqual(calls.map((call) => call.path), ["/health", "/health", "/ready", "/ready", "/api/v1/system/status"]);
});

test("does not report a key rejection when the authenticated retry never answers", async () => {
  const calls = [];
  const result = await probeOpenViking(connection(), async (url, init) => {
    const path = new URL(String(url)).pathname;
    const authorized = new Headers(init?.headers).get("Authorization") === "Bearer user-secret";
    calls.push({ path, authorized });
    if (path === "/health" && !authorized) return response(401, { status: "error" });
    if (path === "/ready" && !authorized) return response(401, { status: "error" });
    throw new TypeError("network down");
  });

  assert.deepEqual(result, { reachable: true, ready: false, authenticated: false, keyRejected: false, keyMissing: false, identity: undefined });
  assert.equal(calls.length, 5);
});

test("keeps a 200 status response with a non-JSON body unconfirmed", async () => {
  // A proxy can answer 200 with an HTML page. The endpoint is up and ready, but
  // nothing proves the key was accepted; the UI must not claim it was rejected.
  const result = await probeOpenViking(connection(), async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok" });
    if (path === "/ready") return response(200, { status: "ready" });
    return new Response("<!doctype html><title>proxy</title>", { status: 200, headers: { "content-type": "text/html" } });
  });

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: false, keyRejected: false, keyMissing: false, identity: undefined });
});

test("reports no identity when the status response carries no identity fields", async () => {
  const result = await probeOpenViking(connection(), async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok" });
    if (path === "/ready") return response(200, { status: "ready" });
    return response(200, { status: "ok", result: { initialized: true } });
  });

  assert.deepEqual(result, { reachable: true, ready: true, authenticated: true, keyRejected: false, keyMissing: false, identity: undefined });
});

test("bounds the whole probe with one shared budget, not one per request", async () => {
  // /health answers, /ready hangs. With only a per-request timeout the probe
  // would wait out the full 5s; the shared budget must cut it short. The fake
  // request keeps the loop alive with its own timer, because an unref'd
  // AbortSignal.timeout only fires while something else holds the loop open.
  const started = Date.now();
  const result = await probeOpenViking(connection(), async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path === "/health") return response(200, { status: "ok" });
    // fetch rejects a request whose signal is already aborted; the mock does
    // the same so the shared budget is the only thing under test.
    if (init.signal.aborted) throw init.signal.reason;
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("request timeout")), 5_000);
      init.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Error("aborted")); }, { once: true });
    });
  }, { requestTimeoutMs: 5_000, totalTimeoutMs: 80 });
  const elapsed = Date.now() - started;

  assert.deepEqual(result, { reachable: true, ready: false, authenticated: false, keyRejected: false, keyMissing: false, identity: undefined });
  assert.ok(elapsed < 1_000, `the shared budget must bound the whole probe, took ${elapsed}ms`);
});

test("keeps a non-authentication HTTP error unreachable", async () => {
  const calls = [];
  const result = await probeOpenViking(connection(), async (url) => {
    calls.push(String(url));
    return response(500, { status: "error" });
  });

  assert.deepEqual(result, { reachable: false, ready: false, authenticated: false, keyRejected: false, keyMissing: false, identity: undefined });
  assert.equal(calls.length, 1);
});

test("reports an unavailable service without calling the authenticated endpoint", async () => {
  const calls = [];
  const result = await probeOpenViking(connection(), async (url) => {
    calls.push(String(url));
    throw new TypeError("network down");
  });

  assert.deepEqual(result, { reachable: false, ready: false, authenticated: false, keyRejected: false, keyMissing: false, identity: undefined });
  assert.equal(calls.length, 1);
});
