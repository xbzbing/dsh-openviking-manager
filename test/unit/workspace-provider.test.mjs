import { test } from "node:test";
import assert from "node:assert/strict";
import { Context, Service } from "@deepseek-ai/cordis";

/**
 * The workspace list is read through the context rather than injected, so this
 * covers the wiring itself: `ctx.workspaceRegistry` throws without `inject`,
 * and the reflection lookup only sees a service when it passes `strict: false`.
 */
/** The manager reads the registry lazily, per request, so the probe reads on a
 * later tick — a fiber that has not activated yet cannot see services, and
 * `apply` runs before it does. */
async function probeOn(app, apply, { ready = 30 } = {}) {
  const observed = {};
  app.plugin({
    name: "manager-probe",
    apply: (ctx) => {
      setTimeout(() => apply(ctx, observed), ready);
    },
  });
  await new Promise((resolve) => setTimeout(resolve, ready + 40));
  return observed;
}

class WorkspaceRegistry extends Service {
  constructor(ctx) {
    super(ctx, "workspaceRegistry");
  }
  list() {
    return [{ path: "/work/a" }, { path: "/work/b" }, { path: 42 }];
  }
}

test("reading the registry as a plain property throws without inject", async () => {
  const app = new Context();
  app.plugin(WorkspaceRegistry);
  const observed = await probeOn(app, (ctx, out) => {
    try {
      out.value = ctx.workspaceRegistry?.list?.();
    } catch (error) {
      out.error = error.message;
    }
  });
  // This is the failure the panel showed as "no workspaces registered".
  assert.match(observed.error ?? "", /without inject/);
});

test("the reflection lookup reaches the registry without injecting it", async () => {
  const app = new Context();
  app.plugin(WorkspaceRegistry);
  const observed = await probeOn(app, (ctx, out) => {
    out.strictDefault = ctx.reflect?.get?.("workspaceRegistry")?.list?.();
    out.strictFalse = ctx.reflect?.get?.("workspaceRegistry", false)?.list?.();
  });
  // Both reach it once the providing fiber is active; the plain property
  // access above is what fails, which is why the lookup goes through reflect.
  assert.deepEqual(observed.strictDefault?.map((entry) => entry.path), ["/work/a", "/work/b", 42]);
  assert.deepEqual(observed.strictFalse?.map((entry) => entry.path), ["/work/a", "/work/b", 42]);
});

test("a host without the service yields nothing instead of failing", async () => {
  const app = new Context();
  const observed = await probeOn(app, (ctx, out) => {
    out.value = ctx.reflect?.get?.("workspaceRegistry", false) ?? null;
  });
  assert.equal(observed.value, null);
});
