import test from "node:test";
import assert from "node:assert/strict";
import {
  isOpenVikingInjectedMessage,
  stripOpenVikingInjectedMessages,
} from "../../lib/ov-prestep.js";

test("identifies official OpenViking injected messages by source tag", () => {
  assert.equal(
    isOpenVikingInjectedMessage({ source: { kind: "plugin", plugin: "openviking-memory" } }),
    true,
  );
  assert.equal(
    isOpenVikingInjectedMessage({ source: { kind: "plugin", plugin: "something-else" } }),
    false,
  );
  assert.equal(isOpenVikingInjectedMessage({ source: { kind: "user" } }), false);
  assert.equal(isOpenVikingInjectedMessage({}), false);
  assert.equal(isOpenVikingInjectedMessage({ source: undefined }), false);
});

test("strip removes only OpenViking injections and preserves order of the rest", () => {
  const messages = [
    { id: "m1", source: { kind: "user" } },
    { id: "m2", source: { kind: "plugin", plugin: "openviking-memory", form: "instructions" } },
    { id: "m3" },
    { id: "m4", source: { kind: "plugin", plugin: "openviking-memory", form: "recall" } },
    { id: "m5", source: { kind: "plugin", plugin: "dsh-git-ui" } },
  ];
  const stripped = stripOpenVikingInjectedMessages(messages);
  assert.deepEqual(stripped.map((m) => m.id), ["m1", "m3", "m5"]);
  assert.equal(messages.length, 5);
});
