import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  choiceOf,
  effectivePeerSource,
  needsAttention,
  normalizePeerSource,
  peerSourceTemplates,
} from "../../lib/peer-source.js";

test("the official presets and this panel's directory fallback stay distinct", () => {
  assert.deepEqual(peerSourceTemplates("git"), ["{git_remote}", "{git_root}"]);
  assert.deepEqual(peerSourceTemplates(""), ["{git_remote}", "{git_root}"], "an empty value is the official default");
  assert.deepEqual(peerSourceTemplates("git-directory"), ["{git_remote}", "{git_root}", "{cwd}"]);
  assert.deepEqual(peerSourceTemplates(["a", "b"]), ["a", "b"]);
  assert.deepEqual(peerSourceTemplates("team-{dir}"), ["team-{dir}"]);
  // The official loader treats a bare word that is not a preset as a typo and
  // falls back to `git`; it must not become a literal namespace.
  assert.deepEqual(peerSourceTemplates("my-namespace"), ["{git_remote}", "{git_root}"]);
  // An array is taken verbatim, including non-string entries (the official
  // implementation maps them through String).
  assert.deepEqual(peerSourceTemplates([123, null, "x"]), ["123", "null", "x"]);
  assert.equal(choiceOf(["{git_remote}", "{git_root}"]), "git");
  assert.equal(choiceOf(["{git_remote}", "{git_root}", "{cwd}"]), "git-directory");
  assert.equal(choiceOf(["team-{dir}"]), "custom");
});

test("a layer supplying the rule outranks the one below it", () => {
  const config = {
    plugin: {
      peerSource: "directory",
      dsh: { peerSource: ["{git_remote}", "{git_root}", "{cwd}"] },
    },
  };
  const view = effectivePeerSource(config, {});
  assert.deepEqual(view.templates, ["{git_remote}", "{git_root}", "{cwd}"]);
  assert.equal(view.origin, "plugin.dsh");
  // The shared section the other harnesses read is reported, never merged.
  assert.equal(view.sharedValue, "directory");

  const fromEnv = effectivePeerSource(config, { OPENVIKING_PEER_SOURCE: "none" });
  assert.deepEqual(fromEnv.templates, []);
  assert.equal(fromEnv.origin, "env");

  // A repository file outranks this machine's ovcli.conf, so the view has to
  // name it as the source rather than showing the lower layer.
  const fromWorkspace = effectivePeerSource(config, {}, { value: "cwd", layer: ".openviking/config.json" });
  assert.deepEqual(fromWorkspace.templates, ["{cwd}"]);
  assert.equal(fromWorkspace.origin, "workspace");
});

test("the panel only stays quiet for a rule that both shares and isolates", () => {
  // Repository identity in front keeps clones together; a directory fallback
  // keeps a non-repository workspace its own namespace.
  assert.equal(needsAttention({ templates: ["{git_remote}", "{git_root}", "{cwd}"] }), false);
  // The official default leaves every non-repository directory in the shared
  // user-level space.
  assert.equal(needsAttention({ templates: ["{git_remote}", "{git_root}"] }), true);
  // A bare directory splits a repository per checkout.
  assert.equal(needsAttention({ templates: ["{cwd}"] }), true);
  assert.equal(needsAttention({ templates: [] }), true);
});

test("a submitted rule is refused when the official renderer would blank it", () => {
  // A name is only stored as a name when the official loader knows it.
  assert.equal(normalizePeerSource("cwd"), "cwd");
  assert.equal(normalizePeerSource("none"), "none");
  assert.deepEqual(
    normalizePeerSource("git-directory"),
    ["{git_remote}", "{git_root}", "{cwd}"],
    "the composite rule is stored as templates, because no official preset names it",
  );
  assert.deepEqual(normalizePeerSource(["team-{dir}"]), ["team-{dir}"], "a custom list is stored as a list, not JSON text");
  assert.equal(normalizePeerSource([]), "none");
  // An unknown placeholder renders empty, which would silently fall through to
  // a lower template instead of the namespace the reader asked for.
  assert.throws(() => normalizePeerSource(["team-{nope}"]), /unknown peer\.source placeholder/);
  // A bare word is a misspelled preset, not a literal namespace: the official
  // loader would warn and ignore it, so accepting it would show a rule that
  // never applied.
  assert.throws(() => normalizePeerSource("my-namespace"), /unknown peer\.source preset/);
  assert.deepEqual(normalizePeerSource([123]), ["123"]);
  assert.throws(() => normalizePeerSource(["   "]), /must not be blank/);
  assert.throws(() => normalizePeerSource(Array.from({ length: 9 }, () => "{cwd}")), /at most 8 templates/);
  assert.throws(() => normalizePeerSource(["{" + "cwd".repeat(100) + "}"]), /at most 200 characters/);
});
