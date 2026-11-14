import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { apply } from "../../lib/index.js";
import { openVikingRuntimePrototype } from "../../lib/openviking-gate.js";
import { setOpenVikingEnabled } from "../../lib/session-toggle.js";

// apply() reads the plugin's own preferences synchronously for the tool guard;
// keep that read away from the developer's real $DSH_HOME.
const dshHome = mkdtempSync(join(tmpdir(), "dsh-ovm-apply-"));
process.env.DSH_HOME = dshHome;

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

test("official OpenViking runtime is resolvable for the integration fixture", (t) => {
  // The official runtime (0.5.29+) imports host packages such as
  // @deepseek-ai/dsh-llm, which a bare checkout does not carry. When they are
  // absent the gate degrades to the pre-step strip from the boolean, which the
  // tests below still cover — so skip rather than fail on the environment.
  if (openVikingRuntimePrototype === undefined) {
    t.skip("host packages for the official runtime are not installed here");
    return;
  }
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

test("the persisted MCP remember policy reaches the tool guard", () => {
  const id = "apply-remember-policy";
  setOpenVikingEnabled(id, true);
  const preferencesPath = join(dshHome, "plugin-data", "dsh-openviking-manager", "preferences.json");
  mkdirSync(dirname(preferencesPath), { recursive: true });
  writeFileSync(preferencesPath, JSON.stringify({ disableMcpRemember: true }), "utf8");
  const fixture = createHost();
  try {
    apply(fixture.host);
    const guard = fixture.guard();
    assert.match(guard({ name: "mcp__openviking__remember", agent: { id } }), /Explicit OpenViking memory writes are disabled/);
    assert.equal(guard({ name: "mcp__openviking__find", agent: { id } }), undefined);
  } finally {
    fixture.dispose();
    setOpenVikingEnabled(id, true);
    rmSync(preferencesPath, { force: true });
  }
});

test("the persisted remember policy hides the tool in every new session's schema", () => {
  const id = "apply-remember-restriction";
  setOpenVikingEnabled(id, true);
  const preferencesPath = join(dshHome, "plugin-data", "dsh-openviking-manager", "preferences.json");
  mkdirSync(dirname(preferencesPath), { recursive: true });
  writeFileSync(preferencesPath, JSON.stringify({ disableMcpRemember: true }), "utf8");
  const fixture = createHost();
  const filters = [];
  let lifted = 0;
  const agent = {
    id,
    ctx: {
      tools: {
        restrict(filter) {
          filters.push(filter);
          return () => {
            lifted += 1;
          };
        },
      },
    },
  };
  try {
    apply(fixture.host);
    fixture.handlers.get("agent/created")({ agent });
    assert.deepEqual(filters, [{ deny: ["mcp__openviking__remember"] }]);

    fixture.handlers.get("agent/created")({ agent });
    fixture.handlers.get("tools/change")();
    assert.equal(filters.length, 1, "a live restriction is not stacked");

    // The agent's scope owns the restriction layer; disposing the agent must
    // only forget the bookkeeping, never lift the layer a second time.
    fixture.handlers.get("agent/disposed")({ agent });
    assert.equal(lifted, 0);
  } finally {
    fixture.dispose();
    setOpenVikingEnabled(id, true);
    rmSync(preferencesPath, { force: true });
  }
});

test("a tool registered after the session still ends up restricted", () => {
  const id = "apply-remember-late-tool";
  setOpenVikingEnabled(id, true);
  const preferencesPath = join(dshHome, "plugin-data", "dsh-openviking-manager", "preferences.json");
  mkdirSync(dirname(preferencesPath), { recursive: true });
  writeFileSync(preferencesPath, JSON.stringify({ disableMcpRemember: true }), "utf8");
  const fixture = createHost();
  let known = false;
  const filters = [];
  const agent = {
    id,
    ctx: {
      tools: {
        restrict(filter) {
          if (!known) throw new Error("tools.restrict() names unknown global tool");
          filters.push(filter);
          return () => {};
        },
      },
    },
  };
  try {
    apply(fixture.host);
    fixture.handlers.get("agent/created")({ agent });
    assert.equal(filters.length, 0);

    // The MCP client finishes listing its tools: the retry path must apply.
    known = true;
    fixture.handlers.get("tools/change")();
    assert.deepEqual(filters, [{ deny: ["mcp__openviking__remember"] }]);
  } finally {
    fixture.dispose();
    setOpenVikingEnabled(id, true);
    rmSync(preferencesPath, { force: true });
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
