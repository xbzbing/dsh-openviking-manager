import test from "node:test";
import assert from "node:assert/strict";
import { wrapOpenVikingRuntime } from "../../lib/openviking-gate.js";

class FakeRuntime {
  constructor() {
    this.calls = [];
  }
  async profileMessage(agent) {
    this.calls.push(["profileMessage", agent.id]);
    return { kind: "instructions" };
  }
  async recallMessage(agent) {
    this.calls.push(["recallMessage", agent.id]);
    return { kind: "recall" };
  }
  capture(session) {
    this.calls.push(["capture", session.id]);
    this.calls.push(["capture-enqueued"]);
  }
  maybeCommit(session) {
    this.calls.push(["maybeCommit", session.id]);
  }
  async flush(session) {
    this.calls.push(["flush", session.id]);
    return "flushed";
  }
  async dispose(session) {
    this.calls.push(["dispose", session.id]);
    return "disposed";
  }
  unrelated() {
    this.calls.push(["unrelated"]);
  }
}

function isEnabledExcept(offId) {
  return (sessionId) => sessionId !== offId;
}

function agent(id) {
  return { id, session: { id } };
}

test("disabled sessions short-circuit runtime entry points before any work", async () => {
  const runtime = new FakeRuntime();
  const restore = wrapOpenVikingRuntime(FakeRuntime.prototype, isEnabledExcept("off"));
  try {
    assert.equal(await runtime.profileMessage(agent("off")), null);
    assert.equal(await runtime.recallMessage(agent("off"), []), null);
    assert.equal(runtime.capture({ id: "off" }, { event: "user" }), undefined);
    assert.equal(runtime.maybeCommit({ id: "off" }, { event: "user" }), undefined);
    assert.equal(await runtime.flush({ id: "off" }), undefined);
    assert.equal(await runtime.dispose({ id: "off" }), undefined);
    assert.deepEqual(runtime.calls, []);

    assert.deepEqual(await runtime.profileMessage(agent("on")), { kind: "instructions" });
    assert.deepEqual(await runtime.recallMessage(agent("on"), []), { kind: "recall" });
    assert.equal(runtime.capture({ id: "on" }, { event: "user" }), undefined);
    runtime.maybeCommit({ id: "on" }, { event: "user" });
    assert.equal(await runtime.flush({ id: "on" }), "flushed");
    assert.equal(await runtime.dispose({ id: "on" }), "disposed");
    assert.ok(runtime.calls.some((entry) => entry[0] === "profileMessage"));
    assert.ok(runtime.calls.some((entry) => entry[0] === "capture-enqueued"));

    runtime.unrelated();
    assert.deepEqual(runtime.calls.at(-1), ["unrelated"]);
  } finally {
    restore();
  }
});

test("restore() puts the original methods back", async () => {
  const runtime = new FakeRuntime();
  const restore = wrapOpenVikingRuntime(FakeRuntime.prototype, isEnabledExcept("off"));
  assert.equal(await runtime.profileMessage(agent("off")), null);
  restore();
  assert.deepEqual(await runtime.profileMessage(agent("off")), { kind: "instructions" });
  assert.equal(runtime.calls.length, 1);
});

test("missing methods are skipped without throwing", () => {
  const restore = wrapOpenVikingRuntime({}, () => false);
  assert.equal(typeof restore, "function");
  restore();
});
