import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeManagerRoutes } from "../../lib/manager-api.js";
import { resolveUiPreferencesPath } from "../../lib/ui-preferences.js";

const PREFERENCES_PATH = "/plugins/dsh-openviking-manager/api/ui-preferences";

async function withRoutes(t) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-ui-preferences-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const ovcliPath = join(directory, "ovcli.conf");
  const preferencesPath = join(directory, "plugin-data", "preferences.json");
  const routes = new Map(makeManagerRoutes({ ovcliPath, env: {}, preferencesPath }).map((route) => [route.path, route.handler]));
  const server = createServer((req, res) => {
    const handler = routes.get(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
    if (!handler) return void res.writeHead(404).end();
    handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));
  return { base: `http://127.0.0.1:${server.address().port}`, ovcliPath, preferencesPath };
}

async function put(base, body, headers = {}) {
  const response = await fetch(`${base}${PREFERENCES_PATH}`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json(), cache: response.headers.get("cache-control") };
}

test("the composer pill is hidden when no preference is stored", async (t) => {
  const { base } = await withRoutes(t);
  const response = await fetch(`${base}${PREFERENCES_PATH}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true, value: { showInputToggle: false } });
});

test("saving the pill preference writes the plugin's own file and leaves ovcli.conf alone", async (t) => {
  const { base, ovcliPath, preferencesPath } = await withRoutes(t);
  await writeFile(ovcliPath, JSON.stringify({ url: "http://127.0.0.1:1933" }), "utf8");
  const before = await readFile(ovcliPath, "utf8");

  const saved = await put(base, { showInputToggle: true });
  assert.equal(saved.status, 200);
  assert.equal(saved.cache, "no-store");
  assert.deepEqual(saved.json, { ok: true, value: { showInputToggle: true } });
  assert.deepEqual(JSON.parse(await readFile(preferencesPath, "utf8")), { showInputToggle: true });
  assert.equal(await readFile(ovcliPath, "utf8"), before);

  const read = await (await fetch(`${base}${PREFERENCES_PATH}`)).json();
  assert.equal(read.value.showInputToggle, true);
});

test("a save keeps keys the file already carries", async (t) => {
  const { base, preferencesPath } = await withRoutes(t);
  await put(base, { showInputToggle: true });
  const stored = JSON.parse(await readFile(preferencesPath, "utf8"));
  await writeFile(preferencesPath, JSON.stringify({ ...stored, futureKey: 1 }), "utf8");

  await put(base, { showInputToggle: false });
  assert.deepEqual(JSON.parse(await readFile(preferencesPath, "utf8")), { showInputToggle: false, futureKey: 1 });
});

test("invalid preference bodies are rejected without touching the file", async (t) => {
  const { base, preferencesPath } = await withRoutes(t);
  for (const body of [{ showInputToggle: "yes" }, {}, { showInputToggle: true, other: 1 }, [true]]) {
    const { status, json } = await put(base, body);
    assert.equal(status, 400, JSON.stringify(body));
    assert.equal(json.ok, false);
  }
  await assert.rejects(readFile(preferencesPath, "utf8"), { code: "ENOENT" });
});

test("cross-origin writes are refused", async (t) => {
  const { base } = await withRoutes(t);
  const { status } = await put(base, { showInputToggle: true }, { origin: "http://evil.example" });
  assert.equal(status, 403);
});

test("an unreadable preference file falls back to hidden", async (t) => {
  const { base, preferencesPath } = await withRoutes(t);
  await put(base, { showInputToggle: true });
  await writeFile(preferencesPath, "{not json", "utf8");
  const read = await (await fetch(`${base}${PREFERENCES_PATH}`)).json();
  assert.deepEqual(read, { ok: true, value: { showInputToggle: false } });
});

test("the default file lives under the DSH home", () => {
  assert.equal(
    resolveUiPreferencesPath({ DSH_HOME: "/tmp/dsh-home" }),
    "/tmp/dsh-home/plugin-data/dsh-openviking-manager/preferences.json",
  );
});
