/**
 * Locks the DSH compatibility declaration against the versions this repository
 * actually builds and tests against.
 *
 * dsh refuses to start a plugin whose `@deepseek-ai/dsh*` peer ranges exclude
 * the running runtime: the profile boots, the plugin stays installed, and the
 * row is denied with "it stays installed but profile startup denies it". That
 * is a silent-looking total outage of this plugin, and it happens purely from
 * metadata drift — 0.4.0 declared `<0.2.0` and was denied on dsh 0.2.1-alpha.2.
 *
 * The invariant enforced here: the single declared range must accept every
 * version pinned in `devDependencies` (the version we compile and run tests
 * against), and must not silently stretch into the next minor line.
 *
 * The range parser deliberately supports only the `>=A <B` form this manifest
 * uses and throws on anything else, so a rewrite to unsupported syntax fails
 * loudly instead of passing unverified. The comparator is itself checked
 * against the semver.org precedence chain below, so it needs no dependency.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value).trim());
  if (match === null) throw new Error(`unsupported version "${value}"`);
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] === undefined ? [] : match[4].split("."),
  };
}

function compareIdentifiers(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Math.sign(Number(left) - Number(right));
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

/** Semver precedence: core numerically, then "no prerelease" outranks one. */
function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.core[index] !== b.core[index]) return Math.sign(a.core[index] - b.core[index]);
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const l = a.prerelease[index];
    const r = b.prerelease[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    const order = compareIdentifiers(l, r);
    if (order !== 0) return order;
  }
  return 0;
}

/** `>=A <B` (or `>=A`); any other syntax is a hard failure, not a guess. */
function parseRange(range) {
  const parts = String(range).trim().split(/\s+/);
  const lower = parts[0] ?? "";
  if (!lower.startsWith(">=")) {
    throw new Error(`unsupported range "${range}": extend parseRange() in this test before using another form`);
  }
  if (parts.length > 2) throw new Error(`unsupported range "${range}": at most two comparators are understood`);
  const bounds = { min: lower.slice(2) };
  if (parts.length === 2) {
    const upper = parts[1];
    if (!upper.startsWith("<")) throw new Error(`unsupported range "${range}": second comparator must be "<"`);
    bounds.max = upper.slice(1);
  }
  parseVersion(bounds.min);
  if (bounds.max !== undefined) parseVersion(bounds.max);
  return bounds;
}

function satisfies(version, range) {
  const { min, max } = parseRange(range);
  if (compareVersions(version, min) < 0) return false;
  if (max !== undefined && compareVersions(version, max) >= 0) return false;
  return true;
}

async function manifest() {
  return JSON.parse(await readFile(join(root, "package.json"), "utf8"));
}

function dshPeerNames(dependencies) {
  return Object.keys(dependencies).filter(
    (name) => name === "@deepseek-ai/dsh" || name.startsWith("@deepseek-ai/dsh-"),
  );
}

test("version comparator follows the semver.org precedence chain", () => {
  const chain = [
    "1.0.0-alpha",
    "1.0.0-alpha.1",
    "1.0.0-alpha.beta",
    "1.0.0-beta",
    "1.0.0-beta.2",
    "1.0.0-beta.11",
    "1.0.0-rc.1",
    "1.0.0",
    "1.0.1",
    "1.1.0",
    "2.0.0",
  ];
  for (let index = 1; index < chain.length; index += 1) {
    const lower = chain[index - 1];
    const upper = chain[index];
    assert.equal(compareVersions(lower, upper), -1, `${lower} must precede ${upper}`);
    assert.equal(compareVersions(upper, lower), 1, `${upper} must follow ${lower}`);
  }
  assert.equal(compareVersions("0.2.1-alpha.2", "0.2.1-alpha.2"), 0);
  assert.equal(compareVersions("0.2.1-alpha.2", "0.2.1"), -1, "a prerelease precedes its own release");
  // Build metadata never participates in precedence.
  assert.equal(compareVersions("0.2.1-alpha.2+build.7", "0.2.1-alpha.2"), 0);
});

test("every @deepseek-ai/dsh peer declares one shared range, identical to engines.dsh", async () => {
  const pkg = await manifest();
  const names = dshPeerNames(pkg.peerDependencies);
  assert.ok(names.length > 0, "the manifest must declare @deepseek-ai/dsh* peers");

  const ranges = new Set(names.map((name) => pkg.peerDependencies[name]));
  assert.equal(
    ranges.size,
    1,
    `every @deepseek-ai/dsh* peer must share one range, found ${JSON.stringify([...ranges])}`,
  );
  const [range] = [...ranges];
  assert.equal(
    pkg.engines.dsh,
    range,
    "engines.dsh must match the peer range so the declared floor cannot drift from the enforced one",
  );
  assert.ok(
    names.includes("@deepseek-ai/dsh-host-webserver"),
    "the host webserver peer must stay declared: the manager registers routes through it",
  );
});

test("the declared range accepts every pinned @deepseek-ai/dsh* devDependency", async () => {
  const pkg = await manifest();
  const names = dshPeerNames(pkg.devDependencies);
  assert.ok(names.length > 0, "the manifest must pin @deepseek-ai/dsh* devDependencies");
  const range = pkg.engines.dsh;

  const pinned = new Set(names.map((name) => pkg.devDependencies[name]));
  assert.equal(
    pinned.size,
    1,
    `every @deepseek-ai/dsh* devDependency must be pinned to one version, found ${JSON.stringify([...pinned])}`,
  );

  for (const name of names) {
    const version = pkg.devDependencies[name];
    assert.ok(
      satisfies(version, range),
      `${name}@${version} is built and tested against but is outside the declared range "${range}"; `
        + "dsh denies the whole plugin when a @deepseek-ai/dsh* peer range excludes the running runtime",
    );
  }
});

test("the declared range covers the whole 0.2 line and stops before the next minor", async () => {
  const pkg = await manifest();
  const range = pkg.engines.dsh;
  const { max } = parseRange(range);
  assert.ok(
    max !== undefined,
    `"${range}" must carry an upper bound: an open-ended range would claim runtimes this plugin was never checked against`,
  );

  // The runtime that exposed this: dsh 0.2.1-alpha.2 denied 0.4.0 because
  // "<0.2.0" excluded the entire 0.2 line.
  for (const version of ["0.2.0-rc.1", "0.2.0", "0.2.1-alpha.2", "0.2.5"]) {
    assert.ok(
      satisfies(version, range),
      `"${range}" must accept the 0.2 line, but rejected ${version}`,
    );
  }

  // The upper bound must exclude the next line entirely, prereleases included.
  const { core } = parseVersion(max);
  const nextLine = `${core[0]}.${core[1]}.${core[2]}`;
  for (const version of [`${nextLine}-0`, `${nextLine}-rc.1`, nextLine]) {
    assert.equal(
      satisfies(version, range),
      false,
      `"${range}" must not claim ${version}: a new minor needs its own verified widening`,
    );
  }

  // The floor stays where the previous release put it unless deliberately raised.
  assert.equal(
    satisfies("0.1.6-alpha.2", range),
    true,
    `"${range}" must keep accepting the documented floor 0.1.6-alpha.2`,
  );
  assert.equal(
    satisfies("0.1.6-alpha.1", range),
    false,
    "a version below the declared floor must stay outside the range",
  );
});
