import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  effectiveRecallTuning,
  parseRecallTuningPatch,
  recallTuningPending,
  recallTuningView,
  saveRecallTuning,
  snapshotLoadedRecallTuning,
} from "../../lib/recall-tuning.js";

async function tempConfig(t, value) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-recall-tuning-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "ovcli.conf");
  if (value !== undefined) await writeFile(path, JSON.stringify(value, null, 2), "utf8");
  return path;
}

test("an untouched config reports the official defaults with nothing configured", () => {
  const state = effectiveRecallTuning({}, {});

  assert.deepEqual(state.scoreThreshold, {
    value: 0.35,
    source: "default",
    configured: false,
    envOverride: "",
    envVar: "OPENVIKING_SCORE_THRESHOLD",
  });
  assert.deepEqual(state.recallLimit, {
    value: 10,
    source: "default",
    configured: false,
    envOverride: "",
    envVar: "OPENVIKING_RECALL_LIMIT",
  });
  assert.equal(state.recallQueryExpansion.value, "auto");
  assert.equal(state.recallQueryExpansion.configured, false);
  assert.deepEqual(state.recallExcludeUris.value, []);
  assert.equal(state.recallExcludeUris.envVar, "OPENVIKING_RECALL_EXCLUDE_URIS");
});

test("the effective value follows the official layer order, alias included", () => {
  assert.deepEqual(
    effectiveRecallTuning({ plugin: { scoreThreshold: 0.6 } }, {}).scoreThreshold,
    { value: 0.6, source: "plugin", configured: true, envOverride: "", envVar: "OPENVIKING_SCORE_THRESHOLD" },
  );
  // The harness section wins over the shared one, exactly as the official
  // loader merges them, and env outranks every file.
  assert.equal(
    effectiveRecallTuning({ plugin: { scoreThreshold: 0.6, dsh: { scoreThreshold: 0.4 } } }, {}).scoreThreshold.value,
    0.4,
  );
  assert.equal(
    effectiveRecallTuning({ plugin: { scoreThreshold: 0.6 } }, { OPENVIKING_SCORE_THRESHOLD: "0.9" }).scoreThreshold.value,
    0.9,
  );
  const envKnob = effectiveRecallTuning({}, { OPENVIKING_SCORE_THRESHOLD: "0.9" }).scoreThreshold;
  assert.equal(envKnob.source, "env");
  assert.equal(envKnob.envOverride, "0.9");
  // The official alias resolves, and the canonical name wins within one layer.
  assert.equal(effectiveRecallTuning({ plugin: { recallScoreThreshold: 0.7 } }, {}).scoreThreshold.value, 0.7);
  assert.equal(
    effectiveRecallTuning({ plugin: { recallScoreThreshold: 0.7, scoreThreshold: 0.5 } }, {}).scoreThreshold.value,
    0.5,
  );
  // sendOnlyWhenConfigured knobs distinguish "absent" from "explicitly 10".
  assert.equal(effectiveRecallTuning({ plugin: { recallLimit: 10 } }, {}).recallLimit.configured, true);
  assert.equal(effectiveRecallTuning({ plugin: { recallQueryExpansion: "auto" } }, {}).recallQueryExpansion.configured, true);
});

test("a layer that does not parse is ignored, and out-of-domain values clamp", () => {
  assert.equal(effectiveRecallTuning({ plugin: { scoreThreshold: "abc" } }, {}).scoreThreshold.value, 0.35);
  assert.equal(effectiveRecallTuning({ plugin: { recallQueryExpansion: "sometimes" } }, {}).recallQueryExpansion.value, "auto");
  // The official coercion clamps rather than rejecting: a config file must not
  // kill a hook.
  assert.equal(effectiveRecallTuning({ plugin: { scoreThreshold: 2 } }, {}).scoreThreshold.value, 1);
  assert.equal(effectiveRecallTuning({ plugin: { recallLimit: 0 } }, {}).recallLimit.value, 1);
  assert.equal(effectiveRecallTuning({ plugin: { recallLimit: 999 } }, {}).recallLimit.value, 50);
  assert.deepEqual(
    effectiveRecallTuning({ plugin: { recallExcludeUris: "viking://a, viking://b" } }, {}).recallExcludeUris.value,
    ["viking://a", "viking://b"],
  );
  assert.deepEqual(
    effectiveRecallTuning({}, { OPENVIKING_RECALL_EXCLUDE_URIS: "viking://x,viking://y" }).recallExcludeUris.value,
    ["viking://x", "viking://y"],
  );
});

test("saving writes official keys to the shared section and keeps everything else", async (t) => {
  const path = await tempConfig(t, {
    url: "http://127.0.0.1:1933",
    api_key: "keep-this-secret",
    unknown_tool_key: { keep: true },
    plugin: {
      recallPeerScope: "actor",
      recallQueryExpansion: "off",
      dsh: { recallLimit: 5, other: 1 },
    },
  });

  await saveRecallTuning(path, {
    scoreThreshold: 0.6,
    recallLimit: 6,
    recallQueryExpansion: "off",
    recallExcludeUris: ["viking://user/xubingzhen/skills"],
  });

  const stored = JSON.parse(await readFile(path, "utf8"));
  assert.equal(stored.plugin.scoreThreshold, 0.6);
  assert.equal(stored.plugin.recallLimit, 6, "the shared section wins over a stale harness override");
  assert.equal(stored.plugin.recallQueryExpansion, "off");
  assert.deepEqual(stored.plugin.recallExcludeUris, ["viking://user/xubingzhen/skills"]);
  // Keys this module does not manage are untouched, including the isolation
  // switch and the other keys the harness section carries.
  assert.equal(stored.plugin.recallPeerScope, "actor");
  assert.deepEqual(stored.plugin.dsh, { other: 1 });
  assert.equal(stored.api_key, "keep-this-secret");
  assert.deepEqual(stored.unknown_tool_key, { keep: true });
});

test("restoring the default removes the key instead of pinning it", async (t) => {
  const path = await tempConfig(t, {
    url: "http://127.0.0.1:1933",
    plugin: {
      scoreThreshold: 0.6,
      recallScoreThreshold: 0.4,
      recallLimit: 8,
      recallExcludeUris: ["viking://a"],
      recallPeerScope: "actor",
      dsh: { recallLimit: 5 },
    },
  });

  await saveRecallTuning(path, {
    scoreThreshold: null,
    recallLimit: null,
    recallQueryExpansion: "auto",
    recallExcludeUris: [],
  });

  const stored = JSON.parse(await readFile(path, "utf8"));
  assert.ok(!("scoreThreshold" in stored.plugin));
  assert.ok(!("recallScoreThreshold" in stored.plugin), "the alias cannot survive and mask the removal");
  assert.ok(!("recallLimit" in stored.plugin));
  assert.ok(!("recallQueryExpansion" in stored.plugin));
  assert.ok(!("recallExcludeUris" in stored.plugin));
  // The harness section held only the managed key, so it goes with it.
  assert.ok(!("dsh" in stored.plugin) || !("recallLimit" in stored.plugin.dsh));
  assert.equal(stored.plugin.recallPeerScope, "actor");
});

test("a patch that names no key never rewrites the file", async (t) => {
  const path = await tempConfig(t, { url: "http://127.0.0.1:1933", plugin: { recallPeerScope: "actor" } });
  const before = await readFile(path, "utf8");

  await saveRecallTuning(path, {});

  assert.equal(await readFile(path, "utf8"), before);
});

test("a non-object plugin section is refused instead of being clobbered", async (t) => {
  const path = await tempConfig(t, { plugin: "broken" });

  await assert.rejects(() => saveRecallTuning(path, { scoreThreshold: 0.6 }), /"plugin" section must be an object/);
  assert.equal(JSON.parse(await readFile(path, "utf8")).plugin, "broken");
});

test("saving to a missing file creates it with the safe mode", async (t) => {
  const path = await tempConfig(t, undefined);

  await saveRecallTuning(path, { scoreThreshold: 0.6 });

  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), { plugin: { scoreThreshold: 0.6 } });
  const info = await stat(path);
  assert.equal(info.mode & 0o777, 0o600);
});

test("restartPending compares the file against the loaded snapshot", async (t) => {
  const path = await tempConfig(t, {});
  const loaded = snapshotLoadedRecallTuning(path, {});
  assert.equal(loaded.scoreThreshold.value, 0.35);

  const clean = await recallTuningView(path, { env: {}, loaded });
  assert.equal(clean.restartPending, false);

  await saveRecallTuning(path, { scoreThreshold: 0.6 });
  const pending = await recallTuningView(path, { env: {}, loaded });
  assert.equal(pending.scoreThreshold.value, 0.6);
  assert.equal(pending.restartPending, true);

  // Once the snapshot advances — the plugin re-applied — the same file is not
  // pending any more.
  const reloaded = snapshotLoadedRecallTuning(path, {});
  assert.equal(recallTuningPending(pending, reloaded), false);

  // Dropping back to the default is a change too: the file no longer matches
  // what the plugin loaded.
  await saveRecallTuning(path, { scoreThreshold: null });
  const restored = await recallTuningView(path, { env: {}, loaded: reloaded });
  assert.equal(restored.restartPending, true);
});

test("an env override reports its source and never reads as restart-pending", async (t) => {
  const path = await tempConfig(t, {});
  const env = { OPENVIKING_SCORE_THRESHOLD: "0.8" };
  // The plugin loaded the same variable at startup, so file edits cannot drift.
  const loaded = snapshotLoadedRecallTuning(path, env);
  const view = await recallTuningView(path, { env, loaded });
  assert.equal(view.scoreThreshold.source, "env");
  assert.equal(view.scoreThreshold.envOverride, "0.8");
  assert.equal(view.restartPending, false);

  await saveRecallTuning(path, { scoreThreshold: 0.5 });
  const after = await recallTuningView(path, { env, loaded });
  assert.equal(after.scoreThreshold.value, 0.8, "env outranks the file we just wrote");
  assert.equal(after.restartPending, false);
});

test("a missing or unparsable file snapshots as the official defaults", async (t) => {
  const missing = await tempConfig(t, undefined);
  const state = snapshotLoadedRecallTuning(missing, {});
  assert.equal(state.scoreThreshold.value, 0.35);
  assert.equal(state.recallLimit.value, 10);

  const broken = await tempConfig(t, undefined);
  await writeFile(broken, "{ not json", "utf8");
  assert.equal(snapshotLoadedRecallTuning(broken, {}).recallQueryExpansion.value, "auto");
});

test("the patch parser enforces the official value domain", () => {
  assert.deepEqual(parseRecallTuningPatch({ scoreThreshold: 0.6 }), { scoreThreshold: 0.6 });
  assert.deepEqual(parseRecallTuningPatch({ scoreThreshold: null, recallLimit: null }), {
    scoreThreshold: null,
    recallLimit: null,
  });
  assert.deepEqual(parseRecallTuningPatch({ recallQueryExpansion: "off", recallExcludeUris: ["viking://a"] }), {
    recallQueryExpansion: "off",
    recallExcludeUris: ["viking://a"],
  });
  // A missing key is not a write, so a partial save stays partial.
  assert.deepEqual(parseRecallTuningPatch({ recallLimit: 6 }), { recallLimit: 6 });
  assert.deepEqual(parseRecallTuningPatch({}), {});
  assert.deepEqual(parseRecallTuningPatch({ scoreThreshold: 0.6, somethingElse: 1 }), { scoreThreshold: 0.6 });

  assert.throws(() => parseRecallTuningPatch("nope"), /JSON object/);
  assert.throws(() => parseRecallTuningPatch({ scoreThreshold: 1.5 }), /between 0 and 1/);
  assert.throws(() => parseRecallTuningPatch({ scoreThreshold: "0.6" }), /between 0 and 1/);
  assert.throws(() => parseRecallTuningPatch({ scoreThreshold: Number.NaN }), /between 0 and 1/);
  assert.throws(() => parseRecallTuningPatch({ recallLimit: 0 }), /between 1 and 50/);
  assert.throws(() => parseRecallTuningPatch({ recallLimit: 2.5 }), /integer between 1 and 50/);
  assert.throws(() => parseRecallTuningPatch({ recallQueryExpansion: "sometimes" }), /"auto" or "off"/);
  assert.throws(() => parseRecallTuningPatch({ recallExcludeUris: "viking://a" }), /array of viking:\/\/ URIs/);
  assert.throws(() => parseRecallTuningPatch({ recallExcludeUris: ["https://example.com"] }), /viking:\/\/ URIs/);
  assert.throws(() => parseRecallTuningPatch({ recallExcludeUris: ["viking://two words"] }), /viking:\/\/ URIs/);
  assert.deepEqual(parseRecallTuningPatch({ recallExcludeUris: [] }), { recallExcludeUris: [] });
});
