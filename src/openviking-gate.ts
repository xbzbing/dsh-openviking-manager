/** Per-session gate over the official OpenViking runtime.
 *
 * The official package is an optional peer, so its runtime module is resolved
 * once at module evaluation. Top-level await ensures the prototype is wrapped
 * before apply() can register agents; when the peer is absent, the manager
 * still provides the message and tool guards.
 */

type AnyFn = (...args: any[]) => any;

export type GateSessionEnabled = (sessionId: unknown) => boolean;

function agentSessionId(agent: unknown): unknown {
  const value = agent as { id?: unknown; session?: { id?: unknown } } | null | undefined;
  return value?.id ?? value?.session?.id;
}

function sessionIdOf(session: unknown): unknown {
  return (session as { id?: unknown } | null | undefined)?.id;
}

async function resolveRuntimePrototype(): Promise<Record<string, unknown> | undefined> {
  let entry: string;
  try {
    entry = import.meta.resolve("@openviking/dsh-memory-plugin");
  } catch {
    return undefined;
  }
  try {
    const runtimeHref = new URL("./runtime.mjs", entry).href;
    const mod = (await import(runtimeHref)) as { OpenVikingRuntime?: { prototype?: Record<string, unknown> } };
    return mod.OpenVikingRuntime?.prototype;
  } catch {
    return undefined;
  }
}

export const openVikingRuntimePrototype = await resolveRuntimePrototype();

/** Wrap listed runtime methods so a disabled session short-circuits before any
 * official runtime work. `dispose` is included because it enqueues the final
 * commit during agent teardown. */
export function wrapOpenVikingRuntime(
  proto: Record<string, unknown>,
  isEnabled: GateSessionEnabled,
  isEnabledForStep: GateSessionEnabled = isEnabled,
): () => void {
  const restores: Array<() => void> = [];

  const wrap = (
    name: string,
    pickSession: (...args: unknown[]) => unknown,
    disabledValue: () => unknown,
    policy: GateSessionEnabled,
  ): void => {
    const original = proto[name];
    if (typeof original !== "function") return;
    const originalFn = original as AnyFn;
    proto[name] = function (this: unknown, ...args: unknown[]): unknown {
      if (!policy(pickSession(...args))) return disabledValue();
      return originalFn.apply(this, args);
    };
    restores.push(() => {
      proto[name] = originalFn;
    });
  };

  wrap("profileMessage", agentSessionId, () => Promise.resolve(null), isEnabledForStep);
  wrap("recallMessage", agentSessionId, () => Promise.resolve(null), isEnabledForStep);
  wrap("capture", sessionIdOf, () => undefined, isEnabledForStep);
  wrap("maybeCommit", sessionIdOf, () => undefined, isEnabledForStep);
  wrap("flush", sessionIdOf, () => Promise.resolve(), isEnabledForStep);
  wrap("dispose", sessionIdOf, () => Promise.resolve(), isEnabled);

  return () => {
    for (const restore of restores) restore();
  };
}

/** Install synchronously after the module-level peer resolution completed. */
export function installOpenVikingRuntimeGate(
  isEnabled: GateSessionEnabled,
  isEnabledForStep: GateSessionEnabled = isEnabled,
): (() => void) | undefined {
  if (!openVikingRuntimePrototype) return undefined;
  return wrapOpenVikingRuntime(openVikingRuntimePrototype, isEnabled, isEnabledForStep);
}
