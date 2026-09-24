import { readFileSync } from "node:fs";
import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";
import { harnessSection, pluginSection } from "./recall-scope.js";

/** Config-face editing for the official recall tuning knobs.
 *
 * The keys, value domains and defaults below are the ones declared in the
 * official `shared/config-schema.mjs` of `@openviking/dsh-memory-plugin`
 * (read from 0.5.x); that file stays the single source of truth and this
 * module never invents a knob of its own:
 *
 *   scoreThreshold        number  0..1     default 0.35  OPENVIKING_SCORE_THRESHOLD
 *   recallLimit           int     1..50    default 10    OPENVIKING_RECALL_LIMIT   (sendOnlyWhenConfigured)
 *   recallQueryExpansion  enum    auto|off default auto  OPENVIKING_RECALL_QUERY_EXPANSION (sendOnlyWhenConfigured)
 *   recallExcludeUris     list              default []    OPENVIKING_RECALL_EXCLUDE_URIS
 *
 * Only ovcli.conf's `plugin` section is written — the same face the official
 * loader reads — and every other key (credentials, sections, unknown entries)
 * survives untouched. Resolution mirrors `effectiveRecallScope`: `env` first
 * (it outranks any file this plugin can write and the UI must show the
 * override rather than let a file value pretend), then `plugin.dsh`, then
 * `plugin`, then the official default. The `.openviking/config.json` workspace
 * layer and the legacy `ov.conf` layer are deliberately not read: the first is
 * managed by hand and out of this plugin's scope by contract, the second sits
 * below everything written here.
 *
 * Like the official loader, a layer whose value does not parse is ignored
 * rather than overriding the layer below it. The one deliberate simplification
 * is a blank string: the official coercion treats it as "keep the previous
 * value but mark the knob configured", while here it counts as absent. */

export type RecallTuningEnv = { [key: string]: string | undefined };

export type RecallQueryExpansion = "auto" | "off";

export type RecallTuningSource = "env" | "plugin.dsh" | "plugin" | "default";

export interface RecallTuningKnob<T> {
  /** Effective value after the layers, already clamped into the official domain. */
  value: T;
  /** The layer that supplied the effective value. */
  source: RecallTuningSource;
  /** Some layer explicitly supplied the knob — the official `*Configured` flag,
   * which decides whether `recallLimit`/`recallQueryExpansion` reach the server. */
  configured: boolean;
  /** Raw env value when the environment is the effective layer, else "". */
  envOverride: string;
  /** Env var that outranks the file, for the UI's override warning. */
  envVar: string;
}

export interface RecallTuningState {
  scoreThreshold: RecallTuningKnob<number>;
  recallLimit: RecallTuningKnob<number>;
  recallQueryExpansion: RecallTuningKnob<RecallQueryExpansion>;
  recallExcludeUris: RecallTuningKnob<string[]>;
}

export interface RecallTuningView extends RecallTuningState {
  /** True when the file now asks for something the applied plugin has not loaded. */
  restartPending: boolean;
}

/** Only the keys present in the request are written; `null` (and an empty
 * exclude list, and `auto`) restore the official default by removing the key. */
export interface RecallTuningPatch {
  scoreThreshold?: number | null;
  recallLimit?: number | null;
  recallQueryExpansion?: RecallQueryExpansion;
  recallExcludeUris?: string[] | null;
}

type KnobKind = "number" | "int" | "enum" | "list";

interface KnobSpec {
  key: string;
  aliases: string[];
  envVar: string;
  kind: KnobKind;
  fallback: unknown;
  min?: number;
  max?: number;
  values?: readonly string[];
}

const SCORE_THRESHOLD: KnobSpec = {
  key: "scoreThreshold",
  aliases: ["recallScoreThreshold"],
  envVar: "OPENVIKING_SCORE_THRESHOLD",
  kind: "number",
  fallback: 0.35,
  min: 0,
  max: 1,
};

const RECALL_LIMIT: KnobSpec = {
  key: "recallLimit",
  aliases: [],
  envVar: "OPENVIKING_RECALL_LIMIT",
  kind: "int",
  fallback: 10,
  min: 1,
  max: 50,
};

const QUERY_EXPANSION: KnobSpec = {
  key: "recallQueryExpansion",
  aliases: [],
  envVar: "OPENVIKING_RECALL_QUERY_EXPANSION",
  kind: "enum",
  fallback: "auto",
  values: ["auto", "off"],
};

const EXCLUDE_URIS: KnobSpec = {
  key: "recallExcludeUris",
  aliases: [],
  envVar: "OPENVIKING_RECALL_EXCLUDE_URIS",
  kind: "list",
  fallback: [],
};

const SPECS = [SCORE_THRESHOLD, RECALL_LIMIT, QUERY_EXPANSION, EXCLUDE_URIS];

export const RECALL_TUNING_ENV_VARS: readonly string[] = SPECS.map((spec) => spec.envVar);

const UNPARSEABLE = Symbol("unparseable");
const MAX_EXCLUDE_ENTRIES = 100;
const MAX_EXCLUDE_ENTRY_CHARS = 512;
const VIKING_URI_RE = /^viking:\/\/\S+$/;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

/** Same coercion as the official `coerceKnobValue`, clamping into the declared
 * domain instead of rejecting: a config file must never kill a hook. */
function coerce(spec: KnobSpec, raw: unknown): unknown {
  switch (spec.kind) {
    case "number":
    case "int": {
      if (typeof raw === "string" && raw.trim() === "") return UNPARSEABLE;
      const value = spec.kind === "int" ? Math.round(Number(raw)) : Number(raw);
      if (!Number.isFinite(value)) return UNPARSEABLE;
      const floored = spec.min === undefined ? value : Math.max(spec.min, value);
      return spec.max === undefined ? floored : Math.min(spec.max, floored);
    }
    case "enum": {
      const word = String(raw ?? "").trim();
      return spec.values !== undefined && spec.values.includes(word) ? word : UNPARSEABLE;
    }
    case "list": {
      const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : null;
      if (items === null) return UNPARSEABLE;
      return items
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
}

interface KnobLayer {
  name: Exclude<RecallTuningSource, "default">;
  data: Record<string, unknown> | undefined;
}

function layersOf(config: Record<string, unknown>): KnobLayer[] {
  return [
    // Low to high: within ovcli.conf the harness section wins over the shared
    // one, exactly as loadPluginSettings merges them, and env is applied last.
    { name: "plugin", data: pluginSection(config) },
    { name: "plugin.dsh", data: harnessSection(config) },
  ];
}

function resolveKnob<T>(spec: KnobSpec, layers: KnobLayer[], env: RecallTuningEnv): RecallTuningKnob<T> {
  let value = spec.fallback as T;
  let source: RecallTuningSource = "default";
  let configured = false;

  for (const layer of layers) {
    const data = layer.data;
    if (data === undefined) continue;
    // Aliases first so the canonical name wins when one layer carries both.
    for (const key of [...spec.aliases, spec.key]) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      const raw = data[key];
      if (raw === undefined) continue;
      const coerced = coerce(spec, raw);
      if (coerced === UNPARSEABLE) continue;
      value = coerced as T;
      configured = true;
      source = layer.name;
    }
  }

  const rawEnv = env[spec.envVar];
  if (rawEnv !== undefined && rawEnv !== null && String(rawEnv) !== "") {
    const coerced = coerce(spec, rawEnv);
    if (coerced !== UNPARSEABLE) {
      value = coerced as T;
      configured = true;
      source = "env";
    }
  }

  return {
    value,
    source,
    configured,
    envOverride: source === "env" ? String(rawEnv ?? "") : "",
    envVar: spec.envVar,
  };
}

/** The four knobs resolved through env → plugin.dsh → plugin → default. */
export function effectiveRecallTuning(
  config: Record<string, unknown>,
  env: RecallTuningEnv = {},
): RecallTuningState {
  const layers = layersOf(config);
  return {
    scoreThreshold: resolveKnob<number>(SCORE_THRESHOLD, layers, env),
    recallLimit: resolveKnob<number>(RECALL_LIMIT, layers, env),
    recallQueryExpansion: resolveKnob<RecallQueryExpansion>(QUERY_EXPANSION, layers, env),
    recallExcludeUris: resolveKnob<string[]>(EXCLUDE_URIS, layers, env),
  };
}

function readConfigObject(path: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return asRecord(parsed) ?? {};
  } catch {
    return {};
  }
}

/** Synchronous snapshot taken when the routes are constructed — the moment the
 * official plugin applied with this file. A missing or unparsable file means
 * the official defaults, never a thrown startup error. */
export function snapshotLoadedRecallTuning(path: string, env: RecallTuningEnv = {}): RecallTuningState {
  return effectiveRecallTuning(readConfigObject(path), env);
}

export async function currentRecallTuning(path: string, env: RecallTuningEnv = {}): Promise<RecallTuningState> {
  return effectiveRecallTuning(await readOvcliObject(path), env);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

function sameKnob<T>(left: RecallTuningKnob<T>, right: RecallTuningKnob<T>): boolean {
  // `configured` matters even when the value matches: an absent `recallLimit`
  // and an explicit `10` send different requests to the server.
  return left.configured === right.configured && sameValue(left.value, right.value);
}

export function recallTuningPending(current: RecallTuningState, loaded: RecallTuningState): boolean {
  return !sameKnob(current.scoreThreshold, loaded.scoreThreshold)
    || !sameKnob(current.recallLimit, loaded.recallLimit)
    || !sameKnob(current.recallQueryExpansion, loaded.recallQueryExpansion)
    || !sameKnob(current.recallExcludeUris, loaded.recallExcludeUris);
}

export async function recallTuningView(
  path: string,
  options: { env?: RecallTuningEnv; loaded: RecallTuningState },
): Promise<RecallTuningView> {
  const env = options.env ?? process.env;
  const current = await currentRecallTuning(path, env);
  // An env-configured knob cannot drift: the plugin loaded the same variable
  // at startup and file edits never reach it, so it never reads as pending.
  return { ...current, restartPending: recallTuningPending(current, options.loaded) };
}

function invalid(message: string): Error {
  return new Error(message);
}

function numberOrNull(raw: unknown, key: string, min: number, max: number): number | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    if (raw === undefined) return undefined;
    throw invalid(`${key} must be a number between ${min} and ${max}, or null`);
  }
  if (raw < min || raw > max) throw invalid(`${key} must be a number between ${min} and ${max}, or null`);
  return raw;
}

function intOrNull(raw: unknown, key: string, min: number, max: number): number | null | undefined {
  if (raw === null) return null;
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    if (raw === undefined) return undefined;
    throw invalid(`${key} must be an integer between ${min} and ${max}, or null`);
  }
  if (raw < min || raw > max) throw invalid(`${key} must be an integer between ${min} and ${max}, or null`);
  return raw;
}

function uriListOrNull(raw: unknown, key: string): string[] | null | undefined {
  if (raw === null) return null;
  if (!Array.isArray(raw)) {
    if (raw === undefined) return undefined;
    throw invalid(`${key} must be an array of viking:// URIs, or null`);
  }
  if (raw.length > MAX_EXCLUDE_ENTRIES) {
    throw invalid(`${key} accepts at most ${MAX_EXCLUDE_ENTRIES} entries`);
  }
  const entries: string[] = [];
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
export function parseRecallTuningPatch(raw: unknown): RecallTuningPatch {
  const body = asRecord(raw);
  if (body === undefined) throw invalid("request body must be a JSON object");

  const patch: RecallTuningPatch = {};

  if (Object.hasOwn(body, "scoreThreshold")) {
    const value = numberOrNull(body.scoreThreshold, "scoreThreshold", 0, 1);
    if (value !== undefined) patch.scoreThreshold = value;
  }
  if (Object.hasOwn(body, "recallLimit")) {
    const value = intOrNull(body.recallLimit, "recallLimit", 1, 50);
    if (value !== undefined) patch.recallLimit = value;
  }
  if (Object.hasOwn(body, "recallQueryExpansion")) {
    const value = body.recallQueryExpansion;
    if (value !== "auto" && value !== "off") {
      throw invalid('recallQueryExpansion must be "auto" or "off"');
    }
    patch.recallQueryExpansion = value;
  }
  if (Object.hasOwn(body, "recallExcludeUris")) {
    const value = uriListOrNull(body.recallExcludeUris, "recallExcludeUris");
    if (value !== undefined) patch.recallExcludeUris = value;
  }

  return patch;
}

/** Write the patch to ovcli.conf's `plugin` section.
 *
 * - a supplied value is written to the shared section after clearing any
 *   `plugin.dsh` override, so one section is the single source of the key;
 * - restoring the default (`null`, `[]`, `auto`) removes the key from both
 *   sections — an absent key *is* the official default, so "back to default"
 *   restores stock behaviour instead of pinning a value a future default may
 *   move;
 * - `scoreThreshold` retires its official alias `recallScoreThreshold` when it
 *   is written or removed, so the stale spelling cannot mask the new value.
 *
 * Every other key (credentials, sections, unknown entries) is preserved. */
export async function saveRecallTuning(path: string, patch: RecallTuningPatch): Promise<void> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;

  const existing = await readOvcliObject(path);
  const shared = pluginSection(existing);
  if (existing.plugin !== undefined && shared === undefined) {
    throw new Error('ovcli.conf "plugin" section must be an object');
  }
  const nextShared: Record<string, unknown> = { ...(shared ?? {}) };
  const harness = shared === undefined ? undefined : asRecord(shared.dsh);
  const nextHarness: Record<string, unknown> | undefined = harness === undefined ? undefined : { ...harness };
  let harnessTouched = false;

  /** Retire a key from both sections — "remove it" for a default restore. */
  const drop = (...names: string[]) => {
    for (const name of names) delete nextShared[name];
    dropFromHarness(...names);
  };

  /** Clear a key from the harness section only, so the shared section stays
   * the single source of it while a stale `plugin.dsh` override cannot win. */
  const dropFromHarness = (...names: string[]) => {
    if (nextHarness === undefined) return;
    for (const name of names) {
      if (!Object.hasOwn(nextHarness, name)) continue;
      delete nextHarness[name];
      harnessTouched = true;
    }
  };

  /** Write a value to the shared section; `null`/`auto`/empty means restore
   * the official default by removing the key instead of pinning it. Retiring
   * the key from both sections first keeps one name per section, so a stale
   * `plugin.dsh` override or the legacy alias cannot mask the new value. */
  const put = (spec: KnobSpec, value: unknown, restore: boolean) => {
    drop(spec.key, ...spec.aliases);
    if (!restore) nextShared[spec.key] = value;
  };

  for (const [name, value] of entries) {
    switch (name as keyof RecallTuningPatch) {
      case "scoreThreshold":
        put(SCORE_THRESHOLD, value, value === null);
        break;
      case "recallLimit":
        put(RECALL_LIMIT, value, value === null);
        break;
      case "recallQueryExpansion":
        put(QUERY_EXPANSION, value, value === "auto");
        break;
      case "recallExcludeUris":
        put(EXCLUDE_URIS, value, value === null || value.length === 0);
        break;
    }
  }

  // The harness section only disappears when this write emptied it; an
  // untouched `plugin.dsh` keeps whatever other keys it carries.
  if (harnessTouched && nextHarness !== undefined) {
    if (Object.keys(nextHarness).length > 0) nextShared.dsh = nextHarness;
    else delete nextShared.dsh;
  }

  const next: Record<string, unknown> = { ...existing, plugin: nextShared };
  await writeOvcliObject(path, next);
}
