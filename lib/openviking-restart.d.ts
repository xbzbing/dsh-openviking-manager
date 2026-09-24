/** One-click reload of the official OpenViking memory plugin.
 *
 * The official plugin resolves its configuration once, when its cordis fiber
 * applies, so an ovcli.conf change only reaches the running process when the
 * fiber restarts: cordis `Fiber.restart()` disposes the plugin and re-applies
 * it with the current config, which re-runs `resolveConfig()` and re-reads
 * ovcli.conf (and the workspace files) from disk; the plugin's MCP proxy
 * child process is rebuilt along the way.
 *
 * Only public host mechanisms are used — the registry lookup and the fiber's
 * own restart entry point. The official plugin's code and behaviour are never
 * modified, and when it is absent (optional peer) the caller is told so the
 * UI can fall back to "restart the DSH instance manually".
 *
 * Known side effects of a restart, surfaced to the user in the UI copy: the
 * official runtime disposes with a final commit of every open session, and
 * the MCP tools briefly unregister before their proxy respawns. */
export interface RestartableFiber {
    restart(): Promise<void>;
}
export interface PluginRuntimeLike {
    name?: string;
    fibers?: unknown;
}
export interface RegistryLike {
    get?(plugin: unknown): PluginRuntimeLike | undefined;
    forEach?(visit: (runtime: PluginRuntimeLike, key: unknown) => void): void;
}
export type RestartReason = "plugin-unavailable" | "restart-failed";
export interface RestartResult {
    restarted: boolean;
    /** How many live fibers were restarted. */
    count: number;
    reason?: RestartReason;
    error?: string;
}
/** `name` export of @openviking/dsh-memory-plugin; the registry records it as
 * the runtime's display name, giving a lookup path that does not depend on
 * module identity. */
export declare const OFFICIAL_PLUGIN_NAME = "openviking-memory";
/** Locate the official plugin's live fibers: preferred path is exact registry
 * identity via the module's exported `apply`; the display name is the
 * fallback when module identity does not line up (duplicate installs). */
export declare function findOfficialRuntimes(registry: RegistryLike | undefined): Promise<PluginRuntimeLike[]>;
/** Restart every live fiber of the official plugin. Returns a result value
 * rather than throwing so the route can always answer the UI. */
export declare function restartOfficialOpenViking(ctx: unknown): Promise<RestartResult>;
