import test from "node:test";
import assert from "node:assert/strict";
import {
  beginOpenVikingStep,
  endOpenVikingStep,
  isOpenVikingEnabledForActiveStep,
  isSessionOpenVikingEnabled,
  normalizeSessionId,
  setOpenVikingEnabled,
} from "../../lib/session-toggle.js";

test("sessions default to enabled", () => {
  assert.equal(isSessionOpenVikingEnabled("never-touched-session"), true);
  assert.equal(isSessionOpenVikingEnabled(undefined), true);
  assert.equal(isSessionOpenVikingEnabled(""), true);
  assert.equal(isSessionOpenVikingEnabled(42), true);
});

test("disable and re-enable is tracked per session", () => {
  const id = "unit-toggle-session-1";
  assert.equal(setOpenVikingEnabled(id, false), true);
  assert.equal(isSessionOpenVikingEnabled(id), false);
  assert.equal(isSessionOpenVikingEnabled("unit-toggle-session-2"), true);
  setOpenVikingEnabled(id, true);
  assert.equal(isSessionOpenVikingEnabled(id), true);
});

test("a step snapshots the setting until its lifecycle ends", () => {
  const id = "unit-step-policy";
  setOpenVikingEnabled(id, true);
  assert.equal(beginOpenVikingStep(id), true);
  setOpenVikingEnabled(id, false);
  assert.equal(isOpenVikingEnabledForActiveStep(id), true);
  endOpenVikingStep(id);
  assert.equal(isOpenVikingEnabledForActiveStep(id), false);
  setOpenVikingEnabled(id, true);

  setOpenVikingEnabled(id, false);
  assert.equal(beginOpenVikingStep(id), false);
  setOpenVikingEnabled(id, true);
  assert.equal(isOpenVikingEnabledForActiveStep(id), false);
  endOpenVikingStep(id);
  assert.equal(isOpenVikingEnabledForActiveStep(id), true);
});

test("normalizeSessionId rejects missing and blank ids", () => {
  assert.equal(normalizeSessionId(undefined), undefined);
  assert.equal(normalizeSessionId(null), undefined);
  assert.equal(normalizeSessionId(7), undefined);
  assert.equal(normalizeSessionId("   "), undefined);
  assert.equal(normalizeSessionId(" abc "), "abc");
  assert.equal(setOpenVikingEnabled("  ", false), false);
});
