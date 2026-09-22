/** Per-session gate over the official OpenViking runtime.
 *
 * The official package is an optional peer, so its runtime module is resolved
 * once at module evaluation. Top-level await ensures the prototype is wrapped
 * before apply() can register agents; when the peer is absent, the manager
 * still provides the message and tool guards.
 */
export type GateSessionEnabled = (sessionId: unknown) => boolean;
export declare const openVikingRuntimePrototype: Record<string, unknown> | undefined;
/** Wrap listed runtime methods so a disabled session short-circuits before any
 * official runtime work. `dispose` is included because it enqueues the final
 * commit during agent teardown. */
export declare function wrapOpenVikingRuntime(proto: Record<string, unknown>, isEnabled: GateSessionEnabled, isEnabledForStep?: GateSessionEnabled): () => void;
/** Install synchronously after the module-level peer resolution completed. */
export declare function installOpenVikingRuntimeGate(isEnabled: GateSessionEnabled, isEnabledForStep?: GateSessionEnabled): (() => void) | undefined;
