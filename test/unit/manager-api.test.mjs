import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeManagerRoutes } from "../../lib/manager-api.js";

const ADMIN_PATH = "/plugins/dsh-openviking-manager/api/admin";

async function withRoutes(t, ovcliPath) {
  const routes = new Map(makeManagerRoutes({ ovcliPath }).map((route) => [route.path, route.handler]));
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