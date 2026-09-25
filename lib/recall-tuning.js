import { readFileSync } from "node:fs";
import { readOvcliObject } from "./ovcli-config.js";
import { harnessSection, pluginSection } from "./recall-scope.js";
export const SCORE_THRESHOLD = {
    key: "scoreThreshold",
    aliases: ["recallScoreThreshold"],
    envVar: "OPENVIKING_SCORE_THRESHOLD",
    kind: "number",
    fallback: 0.35,
    min: 0,
    max: 1,
};
export const RECALL_LIMIT = {
    key: "recallLimit",
    aliases: [],
    envVar: "OPENVIKING_RECALL_LIMIT",
    kind: "int",
    fallback: 10,
    min: 1,
    max: 50,
};
export const QUERY_EXPANSION = {
    key: "recallQueryExpansion",
    aliases: [],
    envVar: "OPENVIKING_RECALL_QUERY_EXPANSION",
    kind: "enum",
    fallback: "auto",
    values: ["auto", "off"],
};
export const EXCLUDE_URIS = {
    key: "recallExcludeUris",
    aliases: [],
    envVar: "OPENVIKING_RECALL_EXCLUDE_URIS",
    kind: "list",
    fallback: [],
};
const SPECS = [SCORE_THRESHOLD, RECALL_LIMIT, QUERY_EXPANSION, EXCLUDE_URIS];
export const RECALL_TUNING_ENV_VARS = SPECS.map((spec) => spec.envVar);
/** Product defaults this plugin initialises when no layer supplies a key.
 *
 * The official defaults (0.35 / auto) stay in the config-schema and remain
 * what a keyless file *does*; these are what the first config-page load
 * *writes*, the same way the isolation switch pins `recallPeerScope: "actor"`:
 * weakly related recall is filtered out of the box and the server stops
 * widening the prompt into extra search intents. Only an officially declared
 * knob can carry one, and a layer that did supply the key is never overridden. */
export const PRODUCT_DEFAULTS = new Map([
    [SCORE_THRESHOLD, 0.5],
    [QUERY_EXPANSION, "off"],
]);
const UNPARSEABLE = Symbol("unparseable");
export function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
/** Same coercion as the official `coerceKnobValue`, clamping into the declared
 * domain instead of rejecting: a config file must never kill a hook. */
function coerce(spec, raw) {
    switch (spec.kind) {
        case "number":
        case "int": {
            if (typeof raw === "string" && raw.trim() === "")
                return UNPARSEABLE;
            const value = spec.kind === "int" ? Math.round(Number(raw)) : Number(raw);
            if (!Number.isFinite(value))
                return UNPARSEABLE;
            const floored = spec.min === undefined ? value : Math.max(spec.min, value);
            return spec.max === undefined ? floored : Math.min(spec.max, floored);
        }
        case "enum": {
            const word = String(raw ?? "").trim();
            return spec.values !== undefined && spec.values.includes(word) ? word : UNPARSEABLE;
        }
        case "list": {
            const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : null;
            if (items === null)
                return UNPARSEABLE;
            return items
                .filter((item) => typeof item === "string")
                .map((item) => item.trim())
                .filter(Boolean);
        }
    }
}
function layersOf(config) {
    return [
        // Low to high: within ovcli.conf the harness section wins over the shared
        // one, exactly as loadPluginSettings merges them, and env is applied last.
        { name: "plugin", data: pluginSection(config) },
        { name: "plugin.dsh", data: harnessSection(config) },
    ];
}
function resolveKnob(spec, layers, env) {
    let value = spec.fallback;
    let source = "default";
    let configured = false;
    for (const layer of layers) {
        const data = layer.data;
        if (data === undefined)
            continue;
        // Aliases first so the canonical name wins when one layer carries both.
        for (const key of [...spec.aliases, spec.key]) {
            if (!Object.prototype.hasOwnProperty.call(data, key))
                continue;
            const raw = data[key];
            if (raw === undefined)
                continue;
            const coerced = coerce(spec, raw);
            if (coerced === UNPARSEABLE)
                continue;
            value = coerced;
            configured = true;
            source = layer.name;
        }
    }
    const rawEnv = env[spec.envVar];
    if (rawEnv !== undefined && rawEnv !== null && String(rawEnv) !== "") {
        const coerced = coerce(spec, rawEnv);
        if (coerced !== UNPARSEABLE) {
            value = coerced;
            configured = true;
            source = "env";
        }
    }
    const pinned = PRODUCT_DEFAULTS.has(spec);
    return {
        value,
        source,
        configured,
        envOverride: source === "env" ? String(rawEnv ?? "") : "",
        envVar: spec.envVar,
        // A product default changes what "restore the default" means for this
        // knob; it never changes the effective value of a keyless file.
        default: (pinned ? PRODUCT_DEFAULTS.get(spec) : spec.fallback),
        pinned,
    };
}
/** The four knobs resolved through env → plugin.dsh → plugin → default. */
export function effectiveRecallTuning(config, env = {}) {
    const layers = layersOf(config);
    return {
        scoreThreshold: resolveKnob(SCORE_THRESHOLD, layers, env),
        recallLimit: resolveKnob(RECALL_LIMIT, layers, env),
        recallQueryExpansion: resolveKnob(QUERY_EXPANSION, layers, env),
        recallExcludeUris: resolveKnob(EXCLUDE_URIS, layers, env),
    };
}
function readConfigObject(path) {
    try {
        const parsed = JSON.parse(readFileSync(path, "utf8"));
        return asRecord(parsed) ?? {};
    }
    catch {
        return {};
    }
}
/** Synchronous snapshot taken when the routes are constructed — the moment the
 * official plugin applied with this file. A missing or unparsable file means
 * the official defaults, never a thrown startup error. */
export function snapshotLoadedRecallTuning(path, env = {}) {
    return effectiveRecallTuning(readConfigObject(path), env);
}
export async function currentRecallTuning(path, env = {}) {
    return effectiveRecallTuning(await readOvcliObject(path), env);
}
function sameValue(left, right) {
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left) && Array.isArray(right) && JSON.stringify(left) === JSON.stringify(right);
    }
    return left === right;
}
function sameKnob(left, right) {
    // `configured` matters even when the value matches: an absent `recallLimit`
    // and an explicit `10` send different requests to the server.
    return left.configured === right.configured && sameValue(left.value, right.value);
}
export function recallTuningPending(current, loaded) {
    return !sameKnob(current.scoreThreshold, loaded.scoreThreshold)
        || !sameKnob(current.recallLimit, loaded.recallLimit)
        || !sameKnob(current.recallQueryExpansion, loaded.recallQueryExpansion)
        || !sameKnob(current.recallExcludeUris, loaded.recallExcludeUris);
}
/** The pinned knobs no layer supplies yet, as a ready-to-write patch. A file
 * that already carries them yields `{}`, so initialising once is all it takes. */
export function recallTuningInitPatch(state) {
    const patch = {};
    if (state.scoreThreshold.pinned && state.scoreThreshold.source === "default")
        patch.scoreThreshold = state.scoreThreshold.default;
    if (state.recallLimit.pinned && state.recallLimit.source === "default")
        patch.recallLimit = state.recallLimit.default;
    if (state.recallQueryExpansion.pinned && state.recallQueryExpansion.source === "default")
        patch.recallQueryExpansion = state.recallQueryExpansion.default;
    if (state.recallExcludeUris.pinned && state.recallExcludeUris.source === "default")
        patch.recallExcludeUris = state.recallExcludeUris.default;
    return patch;
}
export async function recallTuningView(path, options) {
    const env = options.env ?? process.env;
    const current = await currentRecallTuning(path, env);
    // An env-configured knob cannot drift: the plugin loaded the same variable
    // at startup and file edits never reach it, so it never reads as pending.
    return {
        ...current,
        restartPending: recallTuningPending(current, options.loaded),
        initPatch: recallTuningInitPatch(current),
    };
}
