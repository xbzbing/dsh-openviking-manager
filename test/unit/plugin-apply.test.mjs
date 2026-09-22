import test from "node:test";
import assert from "node:assert/strict";
import { apply } from "../../lib/index.js";
import { openVikingRuntimePrototype } from "../../lib/openviking-gate.js";
import { setOpenVikingEnabled } from "../../lib/session-toggle.js";

function openVikingMessage() {
  return { source: { kind: "plugin", plugin: "openviking-memory" } };
}

function createHost() {
  const cleanups = [];
  const handlers = new Map();
  let guard;
  const host = {
    webServer: { register: () => () => {} },
    effect(setup) {
      const cleanup = setup();
      if (typeof cleanup === "function") cleanups.push(cleanup);
    },
    on(event, listener) {
      handlers.set(event, listener);
      return () => handlers.delete(event);
    },
    tools: {
      guard(listener) {
        guard = listener;
        return () => {
          guard = undefined;
        };
      },
    },
  };
  return { host, handlers, guard: () => guard, dispose: () => cleanups.reverse().forEach((cleanup) => cleanup()) };
}

test("official OpenViking runtime is resolvable for the integration fixture", () => {
  assert.ok(openVikingRuntimePrototype);
});

test("apply gates real Agent.id for pre-step injection and monotonic MCP guard", async () => {
  const id = "apply-disabled-agent";
  setOpenVikingEnabled(id, false);
  const fixture = createHost();
  try {
    apply(fixture.host);
    const preStep = fixture.handlers.get("agent/pre-step");
    assert.equal(typeof preStep, "function");
    const decision = await preStep(
      { agent: { id, session: { id } }, turn: 1, step: 1 },
      async () => ({ kind: "enter", messages: [{ source: { kind: "user" } }, openVikingMessage()] }),
    );
    assert.deepEqual(decision.messages, [{ source: { kind: "user" } }]);

    const guard = fixture.guard();
    assert.equal(typeof guard, "function");
    assert.match(guard({ name: "mcp__openviking__search", agent: { id } }), /disabled/i);
    assert.equal(guard({ name: "mcp__other__search", agent: { id } }), undefined);
  } finally {
    fixture.dispose();
    setOpenVikingEnabled(id, true);
  }
});

test("a policy toggle affects the next pre-step rather than an active step", async () => {
  const id = "apply-step-snapshot";
  setOpenVikingEnabled(id, true);
  const fixture = createHost();
  try {
    apply(fixture.host);
    const preStep = fixture.handlers.get("agent/pre-step");
    const decision = await preStep(
      { agent: { id, session: { id } }, turn: 1, step: 1 },
      async () => {
        setOpenVikingEnabled(id, false);
        return { kind: "enter", messages: [openVikingMessage()] };
      },
    );
    assert.equal(decision.messages.length, 1);

    const next = await preStep(
      { agent: { id, session: { id } }, turn: 1, step: 2 },
      async () => ({ kind: "enter", messages: [openVikingMessage()] }),
    );
    assert.equal(next.messages.length, 0);
  } finally {
    fixture.dispose();
    setOpenVikingEnabled(id, true);
  }
});
