import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeManagerRoutes } from "../../lib/manager-api.js";

const ADMIN_PATH = "/plugins/dsh-openviking-manager/api/admin";
const SESSION_TOGGLE_PATH = "/plugins/dsh-openviking-manager/api/session-toggle";
const VERSION_PATH = "/plugins/dsh-openviking-manager/api/version";

async function withRoutes(t, ovcliPath, options = {}) {
  const routes = new Map(makeManagerRoutes({ ovcliPath, ...options }).map((route) => [route.path, route.handler]));
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const handler = routes.get(path);
    if (!handler) {
      res.writeHead(404).end();
      return;
    }
    handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));
  return `http://127.0.0.1:${server.address().port}`;
}

async function postAdmin(base, body) {
  const response = await fetch(`${base}${ADMIN_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, json };
}

test("admin without a saved endpoint tells the caller to save one first", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-manager-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"));

  const { status, json } = await postAdmin(base, { operation: "accounts", rootApiKey: "root-for-test" });

  assert.equal(status, 409);
  assert.equal(json.ok, false);
  assert.equal(json.code, "endpoint-not-configured");
  assert.doesNotMatch(json.error, /url must be a non-empty string/);
});

test("admin uses the endpoint saved in ovcli.conf when no url is supplied", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-manager-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:1", account: "personal", user: "alice", api_key: "keep-this-secret" }), "utf8");
  const base = await withRoutes(t, configPath);

  const { status, json } = await postAdmin(base, { operation: "accounts", rootApiKey: "root-for-test" });

  assert.equal(status, 400);
  assert.equal(json.ok, false);
  assert.equal(json.code, undefined);
});

test("admin still accepts an explicit url fallback when ovcli.conf is missing", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-manager-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"));

  const { status, json } = await postAdmin(base, { operation: "accounts", rootApiKey: "root-for-test", url: "http://127.0.0.1:1" });

  assert.equal(status, 400);
  assert.equal(json.ok, false);
  assert.equal(json.code, undefined);
});

test("session-toggle reads the default and applies validated updates", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-manager-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"));
  const sessionId = `unit-session-toggle-${process.pid}-${Date.now()}`;
  const qs = `?sessionId=${encodeURIComponent(sessionId)}`;

  const initial = await fetch(`${base}${SESSION_TOGGLE_PATH}${qs}`);
  assert.equal(initial.status, 200);
  assert.equal(initial.headers.get("cache-control"), "no-store");
  assert.deepEqual(await initial.json(), { ok: true, value: { sessionId, enabled: true } });

  const disable = await fetch(`${base}${SESSION_TOGGLE_PATH}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, enabled: false }),
  });
  assert.equal(disable.status, 200);
  assert.deepEqual(await disable.json(), { ok: true, value: { sessionId, enabled: false } });

  const afterDisable = await fetch(`${base}${SESSION_TOGGLE_PATH}${qs}`);
  assert.equal((await afterDisable.json()).value.enabled, false);

  const missing = await fetch(`${base}${SESSION_TOGGLE_PATH}?sessionId=`);
  assert.equal(missing.status, 400);

  const badEnabled = await fetch(`${base}${SESSION_TOGGLE_PATH}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, enabled: "yes" }),
  });
  assert.equal(badEnabled.status, 400);

  const badMethod = await fetch(`${base}${SESSION_TOGGLE_PATH}${qs}`, { method: "POST" });
  assert.equal(badMethod.status, 405);

  const crossOrigin = await fetch(`${base}${SESSION_TOGGLE_PATH}${qs}`, {
    headers: { origin: "https://attacker.example" },
  });
  assert.equal(crossOrigin.status, 403);

  const oversized = await fetch(`${base}${SESSION_TOGGLE_PATH}?sessionId=${"x".repeat(513)}`);
  assert.equal(oversized.status, 400);
});

test("version returns the local version view without a remote check by default", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-manager-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"));

  const response = await fetch(`${base}${VERSION_PATH}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const json = await response.json();
  assert.equal(json.ok, true);
  assert.equal(typeof json.value.current, "string");
  assert.equal(json.value.checkedRemote, false);
  assert.equal(json.value.repositoryUrl, "https://github.com/xbzbing/dsh-openviking-manager");

  const badMethod = await fetch(`${base}${VERSION_PATH}`, { method: "POST" });
  assert.equal(badMethod.status, 405);

  const crossOrigin = await fetch(`${base}${VERSION_PATH}`, { headers: { origin: "https://attacker.example" } });
  assert.equal(crossOrigin.status, 403);
});

/** A raw request is the only way to set a Host header: `fetch` always derives
 * it from the URL, which is exactly what a DNS-rebinding page does not do. */
function rawRequest(base, path, headers) {
  const target = new URL(path, base);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      headers,
    }, (response) => {
      response.resume();
      response.on("end", () => resolve({ status: response.statusCode }));
    });
    request.on("error", reject);
    request.end();
  });
}

test("refuses a Host it does not serve, even when Origin agrees", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-manager-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"));

  // This is the DNS-rebinding shape: the page's own name is the Host and the
  // Origin matches it, so a plain same-origin comparison would pass.
  const rebound = await rawRequest(base, VERSION_PATH, { host: "evil.example:3080", origin: "http://evil.example:3080" });
  assert.equal(rebound.status, 403);

  // A Host is an authority, not a URL: userinfo must not smuggle loopback in.
  const userinfo = await rawRequest(base, VERSION_PATH, { host: "evil.example@127.0.0.1:3080", origin: "http://evil.example@127.0.0.1:3080" });
  assert.equal(userinfo.status, 403);

  const normal = await rawRequest(base, VERSION_PATH, { host: new URL(base).host, origin: base });
  assert.equal(normal.status, 200);
});

test("accepts an explicitly allowed authority and refuses a cross-site fetch", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-manager-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"), { allowedHosts: ["manager.example"] });

  const allowed = await rawRequest(base, VERSION_PATH, { host: "manager.example", origin: "http://manager.example" });
  assert.equal(allowed.status, 200);

  const crossSite = await fetch(`${base}${VERSION_PATH}`, { headers: { "sec-fetch-site": "cross-site" } });
  assert.equal(crossSite.status, 403);
});
