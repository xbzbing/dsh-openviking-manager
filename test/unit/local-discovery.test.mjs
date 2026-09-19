import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { discoverLocalOpenViking } from "../../lib/local-discovery.js";

test("prefers existing ovcli.conf over inferred local server defaults", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ov-manager-discovery-"));
  const ovcliPath = join(directory, "ovcli.conf");
  const ovconfPath = join(directory, "ov.conf");
  await writeFile(ovcliPath, JSON.stringify({ url: "http://127.0.0.1:8008", api_key: "user-key", account: "personal", user: "alice" }));
  await writeFile(ovconfPath, JSON.stringify({ server: { auth_mode: "api_key", port: 1933, root_api_key: "root-secret" } }));

  const discovery = await discoverLocalOpenViking({ ovcliPath, ovconfPath });

  assert.equal(discovery.ovcli.kind, "ready");
  assert.equal(discovery.suggestedEndpoint, "http://127.0.0.1:8008");
  assert.equal(discovery.localServer.found, true);
  assert.equal(discovery.localServer.authMode, "api_key");
  assert.equal(discovery.localServer.rootKeyAvailable, true);
  assert.equal(JSON.stringify(discovery).includes("root-secret"), false);
});

test("uses a local ov.conf port only when ovcli.conf is absent", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ov-manager-discovery-"));
  const ovconfPath = join(directory, "ov.conf");
  await writeFile(ovconfPath, JSON.stringify({ server: { port: 9001, auth_mode: "trusted" } }));

  const discovery = await discoverLocalOpenViking({ ovcliPath: join(directory, "missing-ovcli.conf"), ovconfPath });

  assert.equal(discovery.ovcli.kind, "missing");
  assert.equal(discovery.suggestedEndpoint, "http://127.0.0.1:9001");
  assert.equal(discovery.localServer.authMode, "trusted");
  assert.equal(discovery.localServer.rootKeyAvailable, false);
});
