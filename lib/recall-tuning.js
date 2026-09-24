import { readFileSync } from "node:fs";
import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";
import { harnessSection, pluginSection } from "./recall-scope.js";
const SCORE_THRESHOLD = {
    key: "scoreThreshold",
    aliases: ["recallScoreThreshold"],
    envVar: "OPENVIKING_SCORE_THRESHOLD",
    kind: "number",
    fallback: 0.35,
    min: 0,
    max: 1,
};
const RECALL_LIMIT = {
    key: "recallLimit",
    aliases: [],
    envVar: "OPENVIKING_RECALL_LIMIT",
    kind: "int",
    fallback: 10,
    min: 1,
    max: 50,
};
const QUERY_EXPANSION = {
    key: "recallQueryExpansion",
    aliases: [],
    envVar: "OPENVIKING_RECALL_QUERY_EXPANSION",
    kind: "enum",
    fallback: "auto",
    values: ["auto", "off"],
};
const EXCLUDE_URIS = {
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
const PRODUCT_DEFAULTS = new Map([
    [SCORE_THRESHOLD, 0.5],
    [QUERY_EXPANSION, "off"],
]);
const UNPARSEABLE = Symbol("unparseable");
const MAX_EXCLUDE_ENTRIES = 100;
const MAX_EXCLUDE_ENTRY_CHARS = 512;
const VIKING_URI_RE = /^viking:\/\/\S+$/;
function asRecord(value) {
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
function invalid(message) {
    return new Error(message);
}
function numberOrNull(raw, key, min, max) {
    if (raw === null)
        return null;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
        if (raw === undefined)
            return undefined;
        throw invalid(`${key} must be a number between ${min} and ${max}, or null`);
    }
    if (raw < min || raw > max)
        throw invalid(`${key} must be a number between ${min} and ${max}, or null`);
    return raw;
}
function intOrNull(raw, key, min, max) {
    if (raw === null)
        return null;
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
        if (raw === undefined)
            return undefined;
        throw invalid(`${key} must be an integer between ${min} and ${max}, or null`);
    }
    if (raw < min || raw > max)
        throw invalid(`${key} must be an integer between ${min} and ${max}, or null`);
    return raw;
}
function uriListOrNull(raw, key) {
    if (raw === null)
        return null;
    if (!Array.isArray(raw)) {
        if (raw === undefined)
            return undefined;
        throw invalid(`${key} must be an array of viking:// URIs, or null`);
    }
    if (raw.length > MAX_EXCLUDE_ENTRIES) {
        throw invalid(`${key} accepts at most ${MAX_EXCLUDE_ENTRIES} entries`);
    }
    const entries = [];
    for (const item of raw) {
        // The official knob takes the list verbatim; the UI validates so a typo
        // cannot silently turn into a filter that never matches.
        if (typeof item !== "string" || item.length > MAX_EXCLUDE_ENTRY_CHARS || !VIKING_URI_RE.test(item)) {
            throw invalid(`${key} entries must be viking:// URIs without spaces, one string each`);
        }
        entries.push(item);
    }
    return entries;
}
/** Validate a PUT body into a patch. Unknown keys are ignored; a missing key
 * leaves that knob untouched, which is what makes a partial save safe. */
export function parseRecallTuningPatch(raw) {
    const body = asRecord(raw);
    if (body === undefined)
        throw invalid("request body must be a JSON object");
    const patch = {};
    if (Object.hasOwn(body, "scoreThreshold")) {
        const value = numberOrNull(body.scoreThreshold, "scoreThreshold", 0, 1);
        if (value !== undefined)
            patch.scoreThreshold = value;
    }
    if (Object.hasOwn(body, "recallLimit")) {
        const value = intOrNull(body.recallLimit, "recallLimit", 1, 50);
        if (value !== undefined)
            patch.recallLimit = value;
    }
    if (Object.hasOwn(body, "recallQueryExpansion")) {
        const value = body.recallQueryExpansion;
        if (value !== null && value !== "auto" && value !== "off") {
            throw invalid('recallQueryExpansion must be "auto", "off", or null');
        }
        patch.recallQueryExpansion = value;
    }
    if (Object.hasOwn(body, "recallExcludeUris")) {
        const value = uriListOrNull(body.recallExcludeUris, "recallExcludeUris");
        if (value !== undefined)
            patch.recallExcludeUris = value;
    }
    return patch;
}
/** Write the patch to ovcli.conf's `plugin` section.
 *
 * - a supplied value is written to the shared section after clearing any
 *   `plugin.dsh` override, so one section is the single source of the key;
 * - `null` (and an empty exclude list) removes the key from both sections —
 *   an absent key *is* the official default, so that is what "back to stock"
 *   means for a knob without a product default;
 * - a pinned knob never comes back as absent through the UI: restoring its
 *   default writes the product default instead, which keeps the value the
 *   next page load would re-pin anyway from bouncing twice;
 * - `scoreThreshold` retires its official alias `recallScoreThreshold` when it
 *   is written or removed, so the stale spelling cannot mask the new value.
 *
 * Every other key (credentials, sections, unknown entries) is preserved. */
export async function saveRecallTuning(path, patch) {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (entries.length === 0)
        return;
    const existing = await readOvcliObject(path);
    const shared = pluginSection(existing);
    if (existing.plugin !== undefined && shared === undefined) {
        throw new Error('ovcli.conf "plugin" section must be an object');
    }
    const nextShared = { ...(shared ?? {}) };
    const harness = shared === undefined ? undefined : asRecord(shared.dsh);
    const nextHarness = harness === undefined ? undefined : { ...harness };
    let harnessTouched = false;
    /** Retire a key from both sections — "remove it" for a default restore. */
    const drop = (...names) => {
        for (const name of names)
            delete nextShared[name];
        dropFromHarness(...names);
    };
    /** Clear a key from the harness section only, so the shared section stays
     * the single source of it while a stale `plugin.dsh` override cannot win. */
    const dropFromHarness = (...names) => {
        if (nextHarness === undefined)
            return;
        for (const name of names) {
            if (!Object.hasOwn(nextHarness, name))
                continue;
            delete nextHarness[name];
            harnessTouched = true;
        }
    };
    /** Write a value to the shared section; `null`/`auto`/empty means restore
     * the official default by removing the key instead of pinning it. Retiring
     * the key from both sections first keeps one name per section, so a stale
     * `plugin.dsh` override or the legacy alias cannot mask the new value. */
    const put = (spec, value, restore) => {
        drop(spec.key, ...spec.aliases);
        if (!restore)
            nextShared[spec.key] = value;
    };
    for (const [name, value] of entries) {
        switch (name) {
            case "scoreThreshold":
                put(SCORE_THRESHOLD, value, value === null);
                break;
            case "recallLimit":
                put(RECALL_LIMIT, value, value === null);
                break;
            case "recallQueryExpansion":
                // `auto` is an explicit choice the UI offers, so it is written rather
                // than dropped: dropping it would hand the key back to the official
                // default and let the next load re-pin the product one. `null` still
                // removes it for a caller that wants stock behaviour.
                put(QUERY_EXPANSION, value, value === null);
                break;
            case "recallExcludeUris":
                put(EXCLUDE_URIS, value, value === null || value.length === 0);
                break;
        }
    }
    // The harness section only disappears when this write emptied it; an
    // untouched `plugin.dsh` keeps whatever other keys it carries.
    if (harnessTouched && nextHarness !== undefined) {
        if (Object.keys(nextHarness).length > 0)
            nextShared.dsh = nextHarness;
        else
            delete nextShared.dsh;
    }
    const next = { ...existing, plugin: nextShared };
    await writeOvcliObject(path, next);
}
