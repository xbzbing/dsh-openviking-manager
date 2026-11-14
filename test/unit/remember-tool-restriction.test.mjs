import test from "node:test";
import assert from "node:assert/strict";
import {
  OPENVIKING_REMEMBER_TOOL,
  RememberToolRestriction,
} from "../../lib/remember-tool-restriction.js";

function fakeAgent(id = "agent-1") {
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
  return { agent, filters, lifted: () => lifted };
}

test("blocking installs one deny restriction per live agent", () => {
  const { agent, filters } = fakeAgent();
  const restriction = new RememberToolRestriction({ isBlocked: () => true });
  restriction.remember(agent);
  restriction.remember(agent);
  restriction.sync();
  assert.deepEqual(filters, [{ deny: [OPENVIKING_REMEMBER_TOOL] }]);
  restriction.dispose();
});

test("a saved allow lifts the restriction and a later block installs a new one", () => {
  let blocked = true;
  const { agent, filters, lifted } = fakeAgent();
  const restriction = new RememberToolRestriction({ isBlocked: () => blocked });
  restriction.remember(agent);
  assert.equal(filters.length, 1);

  blocked = false;
  restriction.sync();
  assert.equal(lifted(), 1);
  restriction.sync();
  assert.equal(lifted(), 1);

  blocked = true;
  restriction.sync();
  assert.equal(filters.length, 2);
  restriction.dispose();
  assert.equal(lifted(), 2);
});

test("agents already live are picked up from the host registry", () => {
  const { agent, filters } = fakeAgent("existing");
  const restriction = new RememberToolRestriction({
    isBlocked: () => true,
    listAgents: () => [agent],
  });
  restriction.sync();
  assert.equal(filters.length, 1);
  restriction.dispose();
});

test("an unknown tool name is retried on the next sync instead of failing the agent", () => {
  const { agent, filters } = fakeAgent();
  let attempts = 0;
  const original = agent.ctx.tools.restrict;
  agent.ctx.tools.restrict = (filter) => {
    attempts += 1;
    if (attempts === 1) throw new Error('tools.restrict() names unknown global tool "mcp__openviking__remember"');
    return original(filter);
  };
  const errors = [];
  const restriction = new RememberToolRestriction({
    isBlocked: () => true,
    onError: (error) => errors.push(error),
  });
  restriction.remember(agent);
  assert.equal(filters.length, 0);
  assert.equal(errors.length, 1);

  restriction.sync();
  assert.equal(filters.length, 1);
  assert.equal(errors.length, 1);
  restriction.dispose();
});

test("a disposed agent is forgotten without double-disposing its scope-owned layer", () => {
  const { agent, lifted } = fakeAgent();
  const restriction = new RememberToolRestriction({ isBlocked: () => true });
  restriction.remember(agent);
  restriction.forget(agent.id);
  restriction.dispose();
  assert.equal(lifted(), 0);
});

test("an agent without a scoped tool registry is left alone", () => {
  const restriction = new RememberToolRestriction({ isBlocked: () => true });
  assert.doesNotThrow(() => restriction.remember({ id: "no-tools" }));
  assert.doesNotThrow(() => restriction.dispose());
});
