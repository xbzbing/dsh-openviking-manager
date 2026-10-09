/**
 * The manager must read and write the exact ovcli.conf / ov.conf the running
 * `@openviking/dsh-memory-plugin` loads. The official resolution lives in that
 * package's `shared/credentials.mjs` (`loadCredentialFiles` / `normalizePath`):
 * `OPENVIKING_CLI_CONFIG_FILE` selects ovcli.conf, `OPENVIKING_CONFIG_FILE`
 * selects ov.conf, each with a `~/.openviking` default, plus one backward-compat
 * quirk where a lone ovcli-shaped `OPENVIKING_CONFIG_FILE` stands in for
 * ovcli.conf. OpenViking server v0.5.0 (#5551) made `OPENVIKING_CLI_CONFIG_FILE`
 * the canonical selector, so a manager that ignored it would silently edit a
 * different file than the plugin reads.
 *
 * These tests pin the resolver to that behaviour with a hermetic JSON loader,
 * so no real file under the developer's home is touched.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import { resolveOpenVikingPaths, normalizeConfigPath } from "../../lib/openviking-paths.js";

const DEFAULT_OVCLI = join(homedir(), ".openviking", "ovcli.conf");
const DEFAULT_OVCONF = join(homedir(), ".openviking", "ov.conf");

/** A loader that fails every read, forcing the no-backward-compat path. */
const noFiles = () => null;

test("with no env the paths are the documented ~/.openviking defaults", () => {
  const paths = resolveOpenVikingPaths({}, noFiles);
  assert.equal(paths.ovcliPath, DEFAULT_OVCLI);
  assert.equal(paths.ovconfPath, DEFAULT_OVCONF);
});

test("OPENVIKING_CLI_CONFIG_FILE selects ovcli.conf and leaves ov.conf default", () => {
  const target = resolvePath("/tmp/profiles/web/ovcli.conf");
  const paths = resolveOpenVikingPaths({ OPENVIKING_CLI_CONFIG_FILE: target }, noFiles);
  assert.equal(paths.ovcliPath, target, "the UI must edit the file the plugin reads");
  assert.equal(paths.ovconfPath, DEFAULT_OVCONF);
});

test("OPENVIKING_CONFIG_FILE selects ov.conf independently of ovcli.conf", () => {
  const ovconf = resolvePath("/tmp/custom/ov.conf");
  // Not ovcli-shaped (it is a server config), so the backward-compat path is
  // not taken and ovcli.conf stays at its default.
  const paths = resolveOpenVikingPaths(
    { OPENVIKING_CONFIG_FILE: ovconf },
    (path) => (path === ovconf ? { server: { port: 1933 } } : null),
  );
  assert.equal(paths.ovcliPath, DEFAULT_OVCLI);
  assert.equal(paths.ovconfPath, ovconf);
});

test("both variables select their own file", () => {
  const cli = resolvePath("/tmp/a/ovcli.conf");
  const ov = resolvePath("/tmp/b/ov.conf");
  const paths = resolveOpenVikingPaths(
    { OPENVIKING_CLI_CONFIG_FILE: cli, OPENVIKING_CONFIG_FILE: ov },
    noFiles,
  );
  assert.equal(paths.ovcliPath, cli);
  assert.equal(paths.ovconfPath, ov);
});

test("a lone ovcli-shaped OPENVIKING_CONFIG_FILE stands in for ovcli.conf", () => {
  const legacy = resolvePath("/tmp/legacy/openviking.json");
  const paths = resolveOpenVikingPaths(
    { OPENVIKING_CONFIG_FILE: legacy },
    (path) => (path === legacy ? { url: "http://127.0.0.1:1933", user: "u" } : null),
  );
  assert.equal(paths.ovcliPath, legacy, "the ovcli-shaped legacy file serves as ovcli.conf");
  assert.equal(paths.ovconfPath, DEFAULT_OVCONF, "ov.conf falls back to its default");
});

test("the backward-compat path is skipped when CLI is also set", () => {
  const legacy = resolvePath("/tmp/legacy/openviking.json");
  const cli = resolvePath("/tmp/explicit/ovcli.conf");
  const paths = resolveOpenVikingPaths(
    { OPENVIKING_CLI_CONFIG_FILE: cli, OPENVIKING_CONFIG_FILE: legacy },
    () => ({ url: "http://127.0.0.1:1933" }),
  );
  assert.equal(paths.ovcliPath, cli, "an explicit CLI file is never displaced by the legacy quirk");
  assert.equal(paths.ovconfPath, legacy);
});

test("a server-shaped OPENVIKING_CONFIG_FILE never masquerades as ovcli.conf", () => {
  const ovconf = resolvePath("/tmp/server/ov.conf");
  const paths = resolveOpenVikingPaths(
    { OPENVIKING_CONFIG_FILE: ovconf },
    () => ({ server: { port: 1933 }, url: "http://127.0.0.1:1933" }),
  );
  // A `server` section disqualifies the file even though it also has `url`.
  assert.equal(paths.ovcliPath, DEFAULT_OVCLI);
  assert.equal(paths.ovconfPath, ovconf);
});

test("blank and whitespace env values fall back to the defaults", () => {
  for (const value of ["", "   "]) {
    const paths = resolveOpenVikingPaths(
      { OPENVIKING_CLI_CONFIG_FILE: value, OPENVIKING_CONFIG_FILE: value },
      noFiles,
    );
    assert.equal(paths.ovcliPath, DEFAULT_OVCLI, `"${value}" must not be treated as a path`);
    assert.equal(paths.ovconfPath, DEFAULT_OVCONF);
  }
});

test("normalizeConfigPath mirrors the official ~, ~/, and resolve rules", () => {
  assert.equal(normalizeConfigPath(""), "");
  assert.equal(normalizeConfigPath("   "), "");
  assert.equal(normalizeConfigPath("~"), homedir());
  assert.equal(normalizeConfigPath("~/x/ovcli.conf"), resolvePath(join(homedir(), "x/ovcli.conf")));
  assert.equal(normalizeConfigPath("/abs/ovcli.conf"), "/abs/ovcli.conf");
  // A relative path resolves against the process cwd, like the official code.
  assert.equal(normalizeConfigPath("rel/ovcli.conf"), resolvePath("rel/ovcli.conf"));
  // A leading/trailing-space value is trimmed before resolution.
  assert.equal(normalizeConfigPath("  /abs/ovcli.conf  "), "/abs/ovcli.conf");
});
