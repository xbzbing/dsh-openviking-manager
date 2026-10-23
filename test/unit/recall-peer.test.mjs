import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  effectivePeerId,
  normalizePeerId,
  peerIdView,
  savePeerId,
  snapshotLoadedPeerId,
} from "../../lib/recall-peer.js";

const PROJECT = {
  available: false,
  cwd: "/tmp/project",
  workspaceRoot: "",
  peer: "",
  peerOrigin: "",
  pinnedPeer: "",
  pinnedPeerSource: "",
  declarations: [],
  warnings: [],
  risks: [],
};

async function tempConfig(t, value) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-recall-peer-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "ovcli.conf");
  if (value !== undefined) await writeFile(path, JSON.stringify(value, null, 2), "utf8");
  return path;
}

test("normalizePeerId accepts the server charset and rejects the rest", () => {
  assert.equal(normalizePeerId(undefined), undefined);
  assert.equal(normalizePeerId(null), undefined);
  assert.equal(normalizePeerId(""), undefined);
  assert.equal(normalizePeerId("   "), undefined);
  assert.equal(normalizePeerId("github.com-xbzbing-dsh-openviking-manager"), "github.com-xbzbing-dsh-openviking-manager");
  assert.equal(normalizePeerId("  team_a@host.example  "), "team_a@host.example");
  assert.throws(() => normalizePeerId(42), /must be a string/);
  assert.throws(() => normalizePeerId("has spaces"), /may only contain/);
  assert.throws(() => normalizePeerId("bad/slash"), /may only contain/);
  assert.throws(() => normalizePeerId("x".repeat(101)), /at most 100/);
  // The server reserves `ext-` for externally encoded identities (0.5.2 uses
  // lossless ext-<base64> ids) and the official sanitizer rewrites a value
  // occupying it, so the panel refuses it instead of storing a different key.
  assert.throws(() => normalizePeerId("ext-ZW4t5Lit5paH"), /reserves that prefix/);
  assert.throws(() => normalizePeerId("EXT-team"), /reserves that prefix/);
});

test("the effective peer id follows the layer order this plugin can see", () => {
  assert.deepEqual(effectivePeerId({}, {}), { peerId: "", source: "default", envOverride: "", ovcliOverride: "" });
  assert.deepEqual(
    effectivePeerId({ plugin: { peerId: "shared-peer" } }, {}),
    { peerId: "shared-peer", source: "plugin", envOverride: "", ovcliOverride: "" },
  );
  // The harness section outranks the shared one, like loadPluginSettings.
  assert.deepEqual(
    effectivePeerId({ plugin: { peerId: "shared-peer", dsh: { peerId: "dsh-peer" } } }, {}),
    { peerId: "dsh-peer", source: "plugin.dsh", envOverride: "", ovcliOverride: "" },
  );
  // The legacy alias is honoured where the canonical key is absent.
  assert.deepEqual(
    effectivePeerId({ plugin: { peer_id: "aliased" } }, {}),
    { peerId: "aliased", source: "plugin", envOverride: "", ovcliOverride: "" },
  );
  // A top-level credential is surfaced read-only when nothing in plugin pins.
  assert.deepEqual(
    effectivePeerId({ actor_peer_id: "cred-peer" }, {}),
    { peerId: "cred-peer", source: "ovcli", envOverride: "", ovcliOverride: "cred-peer" },
  );
  // plugin.peerId outranks the top-level credential.
  assert.deepEqual(
    effectivePeerId({ actor_peer_id: "cred-peer", plugin: { peerId: "plugin-peer" } }, {}),
    { peerId: "plugin-peer", source: "plugin", envOverride: "", ovcliOverride: "" },
  );
  // env outranks every file.
  assert.deepEqual(
    effectivePeerId({ plugin: { peerId: "plugin-peer" } }, { OPENVIKING_PEER_ID: "env-peer" }),
    { peerId: "env-peer", source: "env", envOverride: "env-peer", ovcliOverride: "" },
  );
});

test("saving a value writes plugin.dsh and keeps the shared pin for other harnesses", async (t) => {
  const path = await tempConfig(t, {
    url: "http://127.0.0.1:1933",
    api_key: "keep-secret",
    plugin: { recallPeerScope: "actor", peer_id: "shared-stale", dsh: { peer_id: "old", other: 1 } },
  });

  await savePeerId(path, "github.com-xbzbing-dsh-openviking-manager");

  const stored = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(stored.plugin.dsh, { other: 1, peerId: "github.com-xbzbing-dsh-openviking-manager" });
  // The shared section belongs to the other harnesses; this pin is DSH-scoped.
  assert.equal(stored.plugin.peer_id, "shared-stale");
  assert.equal(stored.plugin.recallPeerScope, "actor");
  assert.equal(stored.api_key, "keep-secret");
});

test("clearing removes peerId/peer_id from both sections, restoring auto derivation", async (t) => {
  const path = await tempConfig(t, {
    url: "http://127.0.0.1:1933",
    plugin: { peerId: "pinned", dsh: { peer_id: "pinned" } },
  });

  await savePeerId(path, undefined);

  const stored = JSON.parse(await readFile(path, "utf8"));
  // A leftover shared pin would keep every session pinned even after the panel
  // says "automatic", so clearing retires it as a migration.
  assert.ok(!("peerId" in stored.plugin));
  assert.ok(!("peer_id" in stored.plugin));
  assert.ok(!("dsh" in stored.plugin) || !("peerId" in stored.plugin.dsh));
  assert.equal(stored.url, "http://127.0.0.1:1933");
});

test("clearing does not touch a top-level actor_peer_id credential", async (t) => {
  const path = await tempConfig(t, {
    actor_peer_id: "cred-peer",
    plugin: { peerId: "pinned" },
  });

  await savePeerId(path, undefined);

  const stored = JSON.parse(await readFile(path, "utf8"));
  assert.equal(stored.actor_peer_id, "cred-peer");
  assert.ok(!("peerId" in stored.plugin));
});

test("saving to a missing file creates it at 0600", async (t) => {
  const path = await tempConfig(t, undefined);

  await savePeerId(path, "my-project");

  const stored = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(stored, { plugin: { dsh: { peerId: "my-project" } } });
  const info = await stat(path);
  assert.equal(info.mode & 0o777, 0o600);
});

test("a non-object plugin section is refused instead of being clobbered", async (t) => {
  const path = await tempConfig(t, { plugin: "broken" });

  await assert.rejects(() => savePeerId(path, "x"), /"plugin" section must be an object/);
  assert.equal(JSON.parse(await readFile(path, "utf8")).plugin, "broken");
});

test("restartPending compares the file against the loaded snapshot", async (t) => {
  const path = await tempConfig(t, { plugin: { peerId: "pinned" } });
  const loadedPeerId = snapshotLoadedPeerId(path, {});
  assert.equal(loadedPeerId, "pinned");
  assert.deepEqual(await peerIdView(path, { env: {}, loadedPeerId, project: PROJECT }), {
    peerId: "pinned",
    source: "plugin",
    envOverride: "",
    ovcliOverride: "",
    sharedPeerId: "pinned",
    restartPending: false,
    project: PROJECT,
  });

  await savePeerId(path, undefined);
  const pending = await peerIdView(path, { env: {}, loadedPeerId, project: PROJECT });
  assert.equal(pending.peerId, "");
  assert.equal(pending.source, "default");
  assert.equal(pending.restartPending, true);
});

test("an env override reports its source and never reads as restart-pending", async (t) => {
  const path = await tempConfig(t, {});
  const env = { OPENVIKING_PEER_ID: "env-peer" };
  const loadedPeerId = snapshotLoadedPeerId(path, env);
  assert.equal(loadedPeerId, "env-peer");
  const view = await peerIdView(path, { env, loadedPeerId, project: PROJECT });
  assert.equal(view.source, "env");
  assert.equal(view.envOverride, "env-peer");
  assert.equal(view.restartPending, false);
});

test("a missing file snapshots as the official default (auto per session)", async (t) => {
  const path = await tempConfig(t, undefined);
  assert.equal(snapshotLoadedPeerId(path, {}), "");
});
