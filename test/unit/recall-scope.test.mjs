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

/** What a caller without the official package resolves: no workspace layers,
 * no derived peer. The view embeds it verbatim. */
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
  assert.deepEqual(effectiveRecallScope({}, {}), { scope: "all", source: "default", envOverride: "", workspaceLayer: "" });
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "actor" } }, {}),
    { scope: "actor", source: "plugin", envOverride: "", workspaceLayer: "" },
  );
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "actor", dsh: { recallPeerScope: "all" } } }, {}),
    { scope: "all", source: "plugin.dsh", envOverride: "", workspaceLayer: "" },
  );
  // A workspace layer sits above ovcli.conf but below the environment.
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "actor" } }, {}, {
      workspaceScope: "all",
      workspaceLayer: "config.json (workspace)",
    }),
    { scope: "all", source: "workspace", envOverride: "", workspaceLayer: "config.json (workspace)" },
  );
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "actor" } }, { OPENVIKING_RECALL_PEER_SCOPE: "all" }, {
      workspaceScope: "actor",
      workspaceLayer: "config.json (workspace)",
    }),
    { scope: "all", source: "env", envOverride: "all", workspaceLayer: "" },
  );
  // An unparseable layer is ignored rather than overriding the layer below,
  // exactly like coerceKnobValue returning UNPARSEABLE.
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "actor" } }, { OPENVIKING_RECALL_PEER_SCOPE: "sometimes" }),
    { scope: "actor", source: "plugin", envOverride: "", workspaceLayer: "" },
  );
  assert.deepEqual(
    effectiveRecallScope({ plugin: { recallPeerScope: "sideways", dsh: { recallPeerScope: "actor" } } }, {}),
    { scope: "actor", source: "plugin.dsh", envOverride: "", workspaceLayer: "" },
  );
  assert.deepEqual(effectiveRecallScope({ plugin: "not-an-object" }, {}), {
    scope: "all",
    source: "default",
    envOverride: "",
    workspaceLayer: "",
  });
});

test("saving a scope writes plugin.dsh and leaves the shared section alone", async (t) => {
  const path = await tempConfig(t, {
    url: "http://127.0.0.1:1933",
    api_key: "keep-this-secret",
    unknown_tool_key: { keep: true },
    plugin: { recallPeerScope: "all", recallQueryExpansion: "off", dsh: { other: 1 } },
  });

  await saveRecallScope(path, "actor");

  const stored = JSON.parse(await readFile(path, "utf8"));
  // Flipping the switch must not change what the other harnesses read.
  assert.equal(stored.plugin.recallPeerScope, "all");
  assert.deepEqual(stored.plugin.dsh, { other: 1, recallPeerScope: "actor" });
  assert.equal(stored.plugin.recallQueryExpansion, "off");
  assert.equal(stored.api_key, "keep-this-secret");
  assert.deepEqual(stored.unknown_tool_key, { keep: true });
});

test("saving all is written explicitly instead of deleting the key", async (t) => {
  const path = await tempConfig(t, {
    url: "http://127.0.0.1:1933",
    plugin: { recallPeerScope: "actor", dsh: { recallPeerScope: "actor" } },
  });

  await saveRecallScope(path, "all");

  const stored = JSON.parse(await readFile(path, "utf8"));
  // Deleting the key would fall back to the shared `actor` and silently turn
  // isolation back on; the switch has to mean what it says.
  assert.equal(stored.plugin.dsh.recallPeerScope, "all");
  assert.equal(stored.plugin.recallPeerScope, "actor");
  assert.equal(stored.url, "http://127.0.0.1:1933");
});

test("saving to a missing file creates it without losing the default view", async (t) => {
  const path = await tempConfig(t, undefined);

  await saveRecallScope(path, "actor");

  const stored = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(stored, { plugin: { dsh: { recallPeerScope: "actor" } } });
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
  assert.deepEqual(await recallScopeView(path, { env: {}, loadedScope, project: PROJECT }), {
    scope: "actor",
    source: "plugin",
    envOverride: "",
    workspaceLayer: "",
    sharedScope: "actor",
    restartPending: false,
    project: PROJECT,
  });

  await saveRecallScope(path, "all");
  const pending = await recallScopeView(path, { env: {}, loadedScope, project: PROJECT });
  assert.equal(pending.scope, "all");
  assert.equal(pending.restartPending, true);
});

test("a workspace declaration outranks the file and is named in the view", async (t) => {
  const path = await tempConfig(t, { plugin: { dsh: { recallPeerScope: "actor" } } });
  const project = {
    ...PROJECT,
    declarations: [{ key: "recall.peer_scope", value: "all", layer: "config.json (workspace)" }],
  };

  const view = await recallScopeView(path, { env: {}, loadedScope: "actor", project });

  assert.equal(view.scope, "all");
  assert.equal(view.source, "workspace");
  assert.equal(view.workspaceLayer, "config.json (workspace)");
  assert.equal(view.restartPending, true);
});

test("an env override reports its source and never reads as restart-pending", async (t) => {
  const path = await tempConfig(t, {});
  const env = { OPENVIKING_RECALL_PEER_SCOPE: "actor" };
  // The plugin loaded the same env at startup, so file edits cannot drift.
  const loadedScope = snapshotLoadedRecallScope(path, env);
  assert.equal(loadedScope, "actor");
  const view = await recallScopeView(path, { env, loadedScope, project: PROJECT });
  assert.equal(view.source, "env");
  assert.equal(view.envOverride, "actor");
  assert.equal(view.restartPending, false);
});

test("a missing file snapshots as the official default", async (t) => {
  const path = await tempConfig(t, undefined);
  assert.equal(snapshotLoadedRecallScope(path, {}), "all");
});
