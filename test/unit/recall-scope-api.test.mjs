import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeManagerRoutes } from "../../lib/manager-api.js";

const SCOPE_PATH = "/plugins/dsh-openviking-manager/api/recall-scope";
const RESTART_PATH = "/plugins/dsh-openviking-manager/api/recall-scope/restart";

async function withRoutes(t, ovcliPath, options = {}) {
  const routes = new Map(
    makeManagerRoutes({ ovcliPath, env: {}, ...options }).map((route) => [route.path, route.handler]),
  );
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

async function request(base, path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

test("the default view reports cross-topic sharing with nothing pending", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-scope-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"));

  const { status, json } = await request(base, SCOPE_PATH);

  assert.equal(status, 200);
  assert.deepEqual(json, {
    ok: true,
    value: { scope: "all", source: "default", envOverride: "", restartPending: false },
  });
});

test("turning sharing off writes actor and reports restart-pending until a restart", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-scope-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:1", api_key: "keep-this-secret" }), "utf8");
  let restarts = 0;
  const base = await withRoutes(t, configPath, {
    restartMemoryPlugin: async () => { restarts += 1; return { restarted: true, count: 1 }; },
  });

  const saved = await request(base, SCOPE_PATH, { method: "PUT", body: { scope: "actor" } });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.value.scope, "actor");
  assert.equal(saved.json.value.restartPending, true);

  const stored = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(stored.plugin.recallPeerScope, "actor");
  assert.equal(stored.api_key, "keep-this-secret");

  const restarted = await request(base, RESTART_PATH, { method: "POST" });
  assert.deepEqual(restarted.json, { ok: true, value: { restarted: true, count: 1 } });
  assert.equal(restarts, 1);

  const after = await request(base, SCOPE_PATH);
  assert.equal(after.json.value.restartPending, false);

  const turnedBack = await request(base, SCOPE_PATH, { method: "PUT", body: { scope: "all" } });
  assert.equal(turnedBack.json.value.scope, "all");
  assert.equal(turnedBack.json.value.restartPending, true);
  assert.ok(!("recallPeerScope" in JSON.parse(await readFile(configPath, "utf8")).plugin));
});

test("restart without an injectable plugin answers plugin-unavailable and keeps pending", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-scope-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ plugin: { recallPeerScope: "actor" } }), "utf8");
  // No restartMemoryPlugin: the file already asks for `actor`, which the
  // snapshot loaded at construction, so only the restart is unavailable.
  const base = await withRoutes(t, configPath, {});

  const restarted = await request(base, RESTART_PATH, { method: "POST" });
  assert.equal(restarted.status, 200);
  assert.deepEqual(restarted.json.value, { restarted: false, count: 0, reason: "plugin-unavailable" });

  const view = await request(base, SCOPE_PATH);
  assert.equal(view.json.value.restartPending, false);
});

test("restart reports plugin-unavailable after a change when no plugin can be reloaded", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-scope-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"), {});

  await request(base, SCOPE_PATH, { method: "PUT", body: { scope: "actor" } });
  const restarted = await request(base, RESTART_PATH, { method: "POST" });
  assert.deepEqual(restarted.json.value, { restarted: false, count: 0, reason: "plugin-unavailable" });
  const view = await request(base, SCOPE_PATH);
  assert.equal(view.json.value.restartPending, true);
});

test("an invalid scope is rejected and leaves the file untouched", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-scope-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:1" }), "utf8");
  const base = await withRoutes(t, configPath, {});

  const { status, json } = await request(base, SCOPE_PATH, { method: "PUT", body: { scope: "sometimes" } });

  assert.equal(status, 400);
  assert.equal(json.ok, false);
  assert.equal(JSON.parse(await readFile(configPath, "utf8")).plugin, undefined);
});

test("cross-origin requests are refused and other methods get 405", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-scope-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"), {});

  const crossOrigin = await request(base, SCOPE_PATH, {
    method: "PUT",
    body: { scope: "actor" },
    headers: { origin: "http://evil.example" },
  });
  assert.equal(crossOrigin.status, 403);

  const wrongMethod = await request(base, SCOPE_PATH, { method: "DELETE" });
  assert.equal(wrongMethod.status, 405);

  const wrongRestartMethod = await request(base, RESTART_PATH, { method: "GET" });
  assert.equal(wrongRestartMethod.status, 405);
});
