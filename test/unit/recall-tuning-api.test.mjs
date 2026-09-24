import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeManagerRoutes } from "../../lib/manager-api.js";

const TUNING_PATH = "/plugins/dsh-openviking-manager/api/recall-tuning";
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
  return { status: response.status, headers: response.headers, json: await response.json() };
}

test("the default view reports the official defaults with nothing pending", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-tuning-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"));

  const { status, headers, json } = await request(base, TUNING_PATH);

  assert.equal(status, 200);
  // Every manager route stays non-cacheable: the browser must not hold a key
  // value across a save.
  assert.equal(headers.get("cache-control"), "no-store");
  assert.deepEqual(json.value, {
    scoreThreshold: { value: 0.35, source: "default", configured: false, envOverride: "", envVar: "OPENVIKING_SCORE_THRESHOLD" },
    recallLimit: { value: 10, source: "default", configured: false, envOverride: "", envVar: "OPENVIKING_RECALL_LIMIT" },
    recallQueryExpansion: { value: "auto", source: "default", configured: false, envOverride: "", envVar: "OPENVIKING_RECALL_QUERY_EXPANSION" },
    recallExcludeUris: { value: [], source: "default", configured: false, envOverride: "", envVar: "OPENVIKING_RECALL_EXCLUDE_URIS" },
    restartPending: false,
  });
});

test("saving the tuning keys writes them, then a restart clears the pending state", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-tuning-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:1", api_key: "keep-this-secret", plugin: { recallPeerScope: "actor" } }), "utf8");
  let restarts = 0;
  const base = await withRoutes(t, configPath, {
    restartMemoryPlugin: async () => { restarts += 1; return { restarted: true, count: 1 }; },
  });

  const saved = await request(base, TUNING_PATH, {
    method: "PUT",
    body: {
      scoreThreshold: 0.62,
      recallLimit: 6,
      recallQueryExpansion: "off",
      recallExcludeUris: ["viking://user/xubingzhen/skills", "viking://resources"],
    },
  });

  assert.equal(saved.status, 200);
  assert.equal(saved.json.value.scoreThreshold.value, 0.62);
  assert.equal(saved.json.value.recallLimit.value, 6);
  assert.equal(saved.json.value.recallQueryExpansion.value, "off");
  assert.deepEqual(saved.json.value.recallExcludeUris.value, ["viking://user/xubingzhen/skills", "viking://resources"]);
  assert.equal(saved.json.value.restartPending, true);

  const stored = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(stored.plugin.scoreThreshold, 0.62);
  assert.equal(stored.plugin.recallLimit, 6);
  assert.equal(stored.plugin.recallQueryExpansion, "off");
  assert.deepEqual(stored.plugin.recallExcludeUris, ["viking://user/xubingzhen/skills", "viking://resources"]);
  // The isolation switch and the credentials ride along untouched.
  assert.equal(stored.plugin.recallPeerScope, "actor");
  assert.equal(stored.api_key, "keep-this-secret");

  const restarted = await request(base, RESTART_PATH, { method: "POST" });
  assert.deepEqual(restarted.json, { ok: true, value: { restarted: true, count: 1 } });
  assert.equal(restarts, 1);

  const after = await request(base, TUNING_PATH);
  assert.equal(after.json.value.restartPending, false);

  // Clearing a field restores the official default by dropping the key.
  const cleared = await request(base, TUNING_PATH, {
    method: "PUT",
    body: { scoreThreshold: null, recallLimit: null, recallQueryExpansion: "auto", recallExcludeUris: [] },
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.json.value.scoreThreshold.configured, false);
  assert.equal(cleared.json.value.restartPending, true);
  const emptied = JSON.parse(await readFile(configPath, "utf8"));
  assert.ok(!("scoreThreshold" in emptied.plugin));
  assert.ok(!("recallLimit" in emptied.plugin));
  assert.ok(!("recallQueryExpansion" in emptied.plugin));
  assert.ok(!("recallExcludeUris" in emptied.plugin));
  assert.equal(emptied.plugin.recallPeerScope, "actor");
});

test("an out-of-domain value is rejected and the file stays untouched", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-tuning-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:1", plugin: { scoreThreshold: 0.5 } }), "utf8");
  const base = await withRoutes(t, configPath);

  const { status, json } = await request(base, TUNING_PATH, { method: "PUT", body: { scoreThreshold: 1.5 } });

  assert.equal(status, 400);
  assert.equal(json.ok, false);
  assert.match(json.error, /between 0 and 1/);
  assert.equal(JSON.parse(await readFile(configPath, "utf8")).plugin.scoreThreshold, 0.5);

  const badUri = await request(base, TUNING_PATH, { method: "PUT", body: { recallExcludeUris: ["https://example.com"] } });
  assert.equal(badUri.status, 400);
  const badExpansion = await request(base, TUNING_PATH, { method: "PUT", body: { recallQueryExpansion: "sometimes" } });
  assert.equal(badExpansion.status, 400);
  assert.equal(JSON.parse(await readFile(configPath, "utf8")).plugin.recallQueryExpansion, undefined);
});

test("a partial save only touches the key it names", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-tuning-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ plugin: { scoreThreshold: 0.6, recallPeerScope: "actor" } }), "utf8");
  const base = await withRoutes(t, configPath);

  const { status } = await request(base, TUNING_PATH, { method: "PUT", body: { recallLimit: 4 } });

  assert.equal(status, 200);
  const stored = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(stored.plugin.recallLimit, 4);
  assert.equal(stored.plugin.scoreThreshold, 0.6);
  assert.equal(stored.plugin.recallPeerScope, "actor");
});

test("an env-configured knob is reported as env and stays read-only in effect", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-tuning-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"), {
    env: { OPENVIKING_SCORE_THRESHOLD: "0.9" },
  });

  const { json } = await request(base, TUNING_PATH);

  assert.equal(json.value.scoreThreshold.source, "env");
  assert.equal(json.value.scoreThreshold.envOverride, "0.9");
  assert.equal(json.value.recallLimit.source, "default");
  // The plugin loaded the same variable, so a file value cannot read as pending.
  assert.equal(json.value.restartPending, false);
});

test("cross-origin requests are refused and other methods get 405", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-tuning-api-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const base = await withRoutes(t, join(directory, "ovcli.conf"));

  const crossOrigin = await request(base, TUNING_PATH, {
    method: "PUT",
    body: { scoreThreshold: 0.6 },
    headers: { origin: "http://evil.example" },
  });
  assert.equal(crossOrigin.status, 403);

  const wrongMethod = await request(base, TUNING_PATH, { method: "DELETE" });
  assert.equal(wrongMethod.status, 405);
});
