import { readFileSync } from "node:fs";
import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";
export const RECALL_SCOPE_ENV = "OPENVIKING_RECALL_PEER_SCOPE";
/** `undefined` for anything outside the official enum, matching
 * coerceKnobValue's "an unparseable layer is ignored" behaviour. */
export function normalizeRecallScope(value) {
    return value === "all" || value === "actor" ? value : undefined;
}
function sectionOf(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
export function pluginSection(config) {
    return sectionOf(config.plugin);
}
export function harnessSection(config, harness = "dsh") {
    const plugin = pluginSection(config);
    return plugin === undefined ? undefined : sectionOf(plugin[harness]);
}
/** Resolve the effective scope the way resolveKnobs does: a valid env value
 * wins, then `plugin.dsh`, then `plugin`, then the official default `all`.
 * Invalid values are ignored rather than overriding lower layers. */
export function effectiveRecallScope(config, env = {}) {
    const raw = env[RECALL_SCOPE_ENV]?.trim() ?? "";
    if (raw !== "") {
        const fromEnv = normalizeRecallScope(raw);
        if (fromEnv !== undefined)
            return { scope: fromEnv, source: "env", envOverride: raw };
    }
    const fromHarness = normalizeRecallScope(harnessSection(config)?.recallPeerScope);
    if (fromHarness !== undefined)
        return { scope: fromHarness, source: "plugin.dsh", envOverride: "" };
    const fromShared = normalizeRecallScope(pluginSection(config)?.recallPeerScope);
    if (fromShared !== undefined)
        return { scope: fromShared, source: "plugin", envOverride: "" };
    return { scope: "all", source: "default", envOverride: "" };
}
export async function currentRecallScope(path, env = {}) {
    const config = await readOvcliObject(path);
    return effectiveRecallScope(config, env).scope;
}
/** Synchronous snapshot taken when the routes are constructed — the moment
 * the official plugin applied with this file. A missing or unparsable file
 * means the official default, never a thrown startup error. */
export function snapshotLoadedRecallScope(path, env = {}) {
    let config = {};
    try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            config = parsed;
        }
    }
    catch {
        config = {};
    }
    return effectiveRecallScope(config, env).scope;
}
export async function recallScopeView(path, options) {
    const env = options.env ?? process.env;
    const config = await readOvcliObject(path);
    const effective = effectiveRecallScope(config, env);
    return { ...effective, restartPending: effective.scope !== options.loadedScope };
}
/** Write the scope to ovcli.conf's `plugin` section, mirroring the rules the
 * official loader reads by:
 *
 * - `actor` sets `plugin.recallPeerScope` after clearing any `plugin.dsh`
 *   override, so the shared section is the single source of the value;
 * - `all` removes the key from both sections — an absent key *is* the
 *   official default, so "allow sharing" restores stock behaviour instead of
 *   pinning a value a future default might move.
 *
 * Every other key (credentials, sections, unknown entries) is preserved. */
export async function saveRecallScope(path, scope) {
    const existing = await readOvcliObject(path);
    const shared = pluginSection(existing);
    if (existing.plugin !== undefined && shared === undefined) {
        throw new Error('ovcli.conf "plugin" section must be an object');
    }
    const nextShared = { ...(shared ?? {}) };
    const harness = shared === undefined ? undefined : sectionOf(shared.dsh);
    if (harness !== undefined && Object.hasOwn(harness, "recallPeerScope")) {
        const { recallPeerScope: _removed, ...rest } = harness;
        if (Object.keys(rest).length > 0)
            nextShared.dsh = rest;
        else
            delete nextShared.dsh;
    }
    if (scope === "actor") {
        nextShared.recallPeerScope = "actor";
    }
    else {
        delete nextShared.recallPeerScope;
    }
    const next = { ...existing, plugin: nextShared };
    await writeOvcliObject(path, next);
}
