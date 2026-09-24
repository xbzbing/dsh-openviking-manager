import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  effectiveRecallScope,
  normalizeRecallScope,
  recallScopeView,
  saveRecallScope,
  snapshotLoadedRecallScope,
} from "../../lib/recall-scope.js";

async function tempConfig(t, value) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-recall-scope-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "ovcli.conf");
  if (value !== undefined) await writeFile(path, JSON.stringify(value, null, 2), "utf8");
  return path;
}

test("only the official enum values normalize", () => {
  assert.equal(normalizeRecallScope("all"), "all");
  assert.equal(normalizeRecallScope("actor"), "actor");
  assert.equal(normalizeRecallScope("ALL"), undefined);
  assert.equal(normalizeRecallScope(""), undefined);
  assert.equal(normalizeRecallScope(1), undefined);
  assert.equal(normalizeRecallScope(undefined), undefined);
});

test("the effective scope follows the official layer order", () => {
  assert.deepEqual(effectiveRecallScope({}, {}), { scope: "all", source: "default", envOverride: "" });
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "actor" } }, {}),
    { scope: "actor", source: "plugin", envOverride: "" },
  );
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "actor", dsh: { recallPeerScope: "all" } } }, {}),
    { scope: "all", source: "plugin.dsh", envOverride: "" },
  );
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "actor" } }, { OPENVIKING_RECALL_PEER_SCOPE: "all" }),
    { scope: "all", source: "env", envOverride: "all" },
  );
  // An unparseable layer is ignored rather than overriding the layer below,
  // exactly like coerceKnobValue returning UNPARSEABLE.
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "actor" } }, { OPENVIKING_RECALL_PEER_SCOPE: "sometimes" }),
    { scope: "actor", source: "plugin", envOverride: "" },
  );
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "sideways", dsh: { recallPeerScope: "actor" } } }, {}),
    { scope: "actor", source: "plugin.dsh", envOverride: "" },
  );
  assert.deepEqual(effectiveRecallScope({ plugin: "not-an-object" }, {}), { scope: "all", source: "default", envOverride: "" });
});

test("saving actor writes the shared plugin section and clears the harness override", async (t) => {
  const path = await tempConfig(t, {
    url: "http://127.0.0.1:1933",
    api_key: "keep-this-secret",
    unknown_tool_key: { keep: true },
    plugin: { recallQueryExpansion: "off", dsh: { recallPeerScope: "all", other: 1 } },
  });

  await saveRecallScope(path, "actor");

  const stored = JSON.parse(await readFile(path, "utf8"));
  assert.equal(stored.plugin.recallPeerScope, "actor");
  assert.deepEqual(stored.plugin.dsh, { other: 1 });
  assert.equal(stored.plugin.recallQueryExpansion, "off");
  assert.equal(stored.api_key, "keep-this-secret");
  assert.deepEqual(stored.unknown_tool_key, { keep: true });
});

test("saving all removes the key from both sections, restoring the official default", async (t) => {
  const path = await tempConfig(t, {
    url: "http://127.0.0.1:1933",
    plugin: { recallPeerScope: "actor", dsh: { recallPeerScope: "actor" } },
  });

  await saveRecallScope(path, "all");

  const stored = JSON.parse(await readFile(path, "utf8"));
  assert.ok(!("recallPeerScope" in stored.plugin));
  // The harness section only held the knob, so it is removed rather than
  // left behind as an empty object.
  assert.ok(!("dsh" in stored.plugin) || !("recallPeerScope" in stored.plugin.dsh));
  assert.equal(stored.url, "http://127.0.0.1:1933");
});

test("saving to a missing file creates it without losing the default view", async (t) => {
  const path = await tempConfig(t, undefined);

  await saveRecallScope(path, "actor");

  const stored = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(stored, { plugin: { recallPeerScope: "actor" } });
  const info = await stat(path);
  assert.equal(info.mode & 0o777, 0o600);
});

test("a non-object plugin section is refused instead of being clobbered", async (t) => {
  const path = await tempConfig(t, { plugin: "broken" });

  await assert.rejects(() => saveRecallScope(path, "actor"), /"plugin" section must be an object/);
  assert.equal(JSON.parse(await readFile(path, "utf8")).plugin, "broken");
});

test("restartPending compares the file against the loaded snapshot", async (t) => {
  const path = await tempConfig(t, { plugin: { recallPeerScope: "actor" } });
  const loadedScope = snapshotLoadedRecallScope(path, {});
  assert.equal(loadedScope, "actor");
  assert.deepEqual(await recallScopeView(path, { env: {}, loadedScope }), {
    scope: "actor",
    source: "plugin",
    envOverride: "",
    restartPending: false,
  });

  await saveRecallScope(path, "all");
  const pending = await recallScopeView(path, { env: {}, loadedScope });
  assert.equal(pending.scope, "all");
  assert.equal(pending.restartPending, true);
});

test("an env override reports its source and never reads as restart-pending", async (t) => {
  const path = await tempConfig(t, {});
  const env = { OPENVIKING_RECALL_PEER_SCOPE: "actor" };
  // The plugin loaded the same env at startup, so file edits cannot drift.
  const loadedScope = snapshotLoadedRecallScope(path, env);
  assert.equal(loadedScope, "actor");
  const view = await recallScopeView(path, { env, loadedScope });
  assert.equal(view.source, "env");
  assert.equal(view.envOverride, "actor");
  assert.equal(view.restartPending, false);
});

test("a missing file snapshots as the official default", async (t) => {
  const path = await tempConfig(t, undefined);
  assert.equal(snapshotLoadedRecallScope(path, {}), "all");
});
