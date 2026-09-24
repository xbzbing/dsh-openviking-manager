import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_PLUGIN_NAME,
  findOfficialRuntimes,
  restartOfficialOpenViking,
} from "../../lib/openviking-restart.js";

test("restarts the official plugin through the registry identity lookup", async () => {
  let calls = 0;
  const fiber = { restart: async () => { calls += 1; } };
  const ctx = { registry: { get: () => ({ name: OFFICIAL_PLUGIN_NAME, fibers: [fiber] }) } };

  const result = await restartOfficialOpenViking(ctx);

  assert.deepEqual(result, { restarted: true, count: 1 });
  assert.equal(calls, 1);
});

test("falls back to the display-name scan when module identity does not match", async () => {
  const fiber = { restart: async () => {} };
  const runtimes = [
    { name: "other-plugin", fibers: [fiber] },
    { name: OFFICIAL_PLUGIN_NAME, fibers: [fiber] },
  ];
  const ctx = {
    registry: {
      get: () => undefined,
      forEach: (visit) => runtimes.forEach((runtime, index) => visit(runtime, index)),
    },
  };

  const result = await restartOfficialOpenViking(ctx);

  assert.deepEqual(result, { restarted: true, count: 1 });
});

test("reports plugin-unavailable without a registry, without live fibers, or without the peer", async () => {
  assert.equal((await restartOfficialOpenViking(undefined)).reason, "plugin-unavailable");
  assert.equal((await restartOfficialOpenViking({})).reason, "plugin-unavailable");
  assert.equal(
    (await restartOfficialOpenViking({ registry: { get: () => ({ fibers: [] }) } })).reason,
    "plugin-unavailable",
  );
  assert.equal(
    (await findOfficialRuntimes(undefined)).length,
    0,
  );
});

test("a rejected restart reports restart-failed with the error message", async () => {
  const fiber = { restart: async () => { throw new Error("fiber is inactive"); } };
  const ctx = { registry: { get: () => ({ fibers: [fiber] }) } };

  const result = await restartOfficialOpenViking(ctx);

  assert.equal(result.restarted, false);
  assert.equal(result.reason, "restart-failed");
  assert.equal(result.error, "fiber is inactive");
});

test("one failing fiber among many still counts as a restart", async () => {
  const good = { restart: async () => {} };
  const bad = { restart: async () => { throw new Error("nope"); } };
  const ctx = { registry: { get: () => ({ fibers: [bad, good] }) } };

  const result = await restartOfficialOpenViking(ctx);

  assert.deepEqual(result, { restarted: true, count: 1 });
});
