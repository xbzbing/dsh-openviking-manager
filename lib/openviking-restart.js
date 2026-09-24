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
/** `name` export of @openviking/dsh-memory-plugin; the registry records it as
 * the runtime's display name, giving a lookup path that does not depend on
 * module identity. */
export const OFFICIAL_PLUGIN_NAME = "openviking-memory";
function fibersOf(runtime) {
    const fibers = runtime?.fibers;
    if (fibers === null || typeof fibers !== "object")
        return [];
    if (typeof fibers[Symbol.iterator] !== "function")
        return [];
    try {
        return [...fibers].filter((fiber) => typeof fiber?.restart === "function");
    }
    catch {
        return [];
    }
}
async function officialModule() {
    try {
        // Resolved through the entry URL rather than a bare specifier because the
        // package's `exports` map only publishes "." — the same trick the runtime
        // gate uses to reach ./runtime.mjs.
        const href = import.meta.resolve("@openviking/dsh-memory-plugin");
        return await import(href);
    }
    catch {
        return undefined;
    }
}
/** Locate the official plugin's live fibers: preferred path is exact registry
 * identity via the module's exported `apply`; the display name is the
 * fallback when module identity does not line up (duplicate installs). */
export async function findOfficialRuntimes(registry) {
    if (!registry)
        return [];
    const mod = await officialModule();
    if (mod !== undefined && typeof registry.get === "function") {
        try {
            const runtime = registry.get(mod);
            if (runtime)
                return [runtime];
        }
        catch { /* fall through to the name scan */ }
    }
    const matches = [];
    if (typeof registry.forEach === "function") {
        try {
            registry.forEach((runtime) => {
                if (runtime?.name === OFFICIAL_PLUGIN_NAME)
                    matches.push(runtime);
            });
        }
        catch { /* a registry we cannot scan is a plugin we cannot find */ }
    }
    return matches;
}
/** Restart every live fiber of the official plugin. Returns a result value
 * rather than throwing so the route can always answer the UI. */
export async function restartOfficialOpenViking(ctx) {
    const registry = ctx?.registry;
    const runtimes = await findOfficialRuntimes(registry);
    const fibers = runtimes.flatMap((runtime) => fibersOf(runtime));
    if (fibers.length === 0) {
        return { restarted: false, count: 0, reason: "plugin-unavailable" };
    }
    const results = await Promise.allSettled(fibers.map((fiber) => fiber.restart()));
    const restarted = results.filter((result) => result.status === "fulfilled").length;
    if (restarted > 0)
        return { restarted: true, count: restarted };
    const failure = results.find((result) => result.status === "rejected");
    const error = failure?.reason instanceof Error ? failure.reason.message : String(failure?.reason ?? "unknown");
    return { restarted: false, count: 0, reason: "restart-failed", error };
}
