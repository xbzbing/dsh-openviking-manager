/** Per-session gate over the official OpenViking runtime.
 *
 * The official package is an optional peer, so its runtime module is resolved
 * once at module evaluation. Top-level await ensures the prototype is wrapped
 * before apply() can register agents; when the peer is absent, the manager
 * still provides the message and tool guards.
 */
function agentSessionId(agent) {
    const value = agent;
    return value?.id ?? value?.session?.id;
}
function sessionIdOf(session) {
    return session?.id;
}
async function resolveRuntimePrototype() {
    let entry;
    try {
        entry = import.meta.resolve("@openviking/dsh-memory-plugin");
    }
    catch {
        return undefined;
    }
    try {
        const runtimeHref = new URL("./runtime.mjs", entry).href;
        const mod = (await import(runtimeHref));
        return mod.OpenVikingRuntime?.prototype;
    }
    catch {
        return undefined;
    }
}
export const openVikingRuntimePrototype = await resolveRuntimePrototype();
/** Wrap listed runtime methods so a disabled session short-circuits before any
 * official runtime work. `dispose` is included because it enqueues the final
 * commit during agent teardown. */
export function wrapOpenVikingRuntime(proto, isEnabled, isEnabledForStep = isEnabled) {
    const restores = [];
    const wrap = (name, pickSession, disabledValue, policy) => {
        const original = proto[name];
        if (typeof original !== "function")
            return;
        const originalFn = original;
        proto[name] = function (...args) {
            if (!policy(pickSession(...args)))
                return disabledValue();
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
        for (const restore of restores)
            restore();
    };
}
/** Install synchronously after the module-level peer resolution completed. */
export function installOpenVikingRuntimeGate(isEnabled, isEnabledForStep = isEnabled) {
    if (!openVikingRuntimePrototype)
        return undefined;
    return wrapOpenVikingRuntime(openVikingRuntimePrototype, isEnabled, isEnabledForStep);
}
