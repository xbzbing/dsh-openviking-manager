import { readFileSync } from "node:fs";
import { readOvcliObject } from "./ovcli-config.js";
import { harnessSection, pluginSection } from "./recall-scope.js";

/** Config-face resolution for the official recall tuning knobs.
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
 * This module owns the read/compute path — the knob specs, layer resolution
 * and view assembly. The write path (request validation and the ovcli.conf
 * `plugin`-section save) lives in `recall-tuning-persistence.ts`, which imports
 * the specs exported here so both paths share one definition.
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
 * Two knobs additionally carry a *product* default (see PRODUCT_DEFAULTS):
 * the manager writes it on first load whenever no layer supplied the key, the
 * same way the isolation switch pins `recallPeerScope`. That is a write of a
 * normal official key, never a redefinition of the official default — a file
 * or env value still wins, and a keyless file still behaves officially until
 * the page initialises it.
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
  /** What "the default" means for this knob: the official default, unless the
   * manager pins a product default (see `pinned`). */
  default: T;
  /** True when the manager writes `default` on first load instead of leaving
   * the key absent — the product default, mirroring how the isolation switch
   * pins `recallPeerScope: "actor"`. */
  pinned: boolean;
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
  /** Pinned knobs no layer supplies yet, ready to write. Empty once the file
   * carries them, which is what makes the first-load initialisation idempotent. */
  initPatch: RecallTuningPatch;
}

/** Only the keys present in the request are written. `null` restores the
 * official default by removing the key; a pinned knob's "restore the default"
 * is instead its product default, which the UI sends as a plain value. */
export interface RecallTuningPatch {
  scoreThreshold?: number | null;
  recallLimit?: number | null;
  recallQueryExpansion?: RecallQueryExpansion | null;
  recallExcludeUris?: string[] | null;
}

type KnobKind = "number" | "int" | "enum" | "list";

export interface KnobSpec {
  key: string;
  aliases: string[];
  envVar: string;
  kind: KnobKind;
  fallback: unknown;
  min?: number;
  max?: number;
  values?: readonly string[];
}

export const SCORE_THRESHOLD: KnobSpec = {
  key: "scoreThreshold",
  aliases: ["recallScoreThreshold"],
  envVar: "OPENVIKING_SCORE_THRESHOLD",
  kind: "number",
  fallback: 0.35,
  min: 0,
  max: 1,
};

export const RECALL_LIMIT: KnobSpec = {
  key: "recallLimit",
  aliases: [],
  envVar: "OPENVIKING_RECALL_LIMIT",
  kind: "int",
  fallback: 10,
  min: 1,
  max: 50,
};

export const QUERY_EXPANSION: KnobSpec = {
  key: "recallQueryExpansion",
  aliases: [],
  envVar: "OPENVIKING_RECALL_QUERY_EXPANSION",
  kind: "enum",
  fallback: "auto",
  values: ["auto", "off"],
};

export const EXCLUDE_URIS: KnobSpec = {
  key: "recallExcludeUris",
  aliases: [],
  envVar: "OPENVIKING_RECALL_EXCLUDE_URIS",
  kind: "list",
  fallback: [],
};

const SPECS = [SCORE_THRESHOLD, RECALL_LIMIT, QUERY_EXPANSION, EXCLUDE_URIS];

export const RECALL_TUNING_ENV_VARS: readonly string[] = SPECS.map((spec) => spec.envVar);

/** Product defaults this plugin initialises when no layer supplies a key.
 *
 * The official defaults (0.35 / auto) stay in the config-schema and remain
 * what a keyless file *does*; these are what the first config-page load
 * *writes*, the same way the isolation switch pins `recallPeerScope: "actor"`:
 * weakly related recall is filtered out of the box and the server stops
 * widening the prompt into extra search intents. Only an officially declared
 * knob can carry one, and a layer that did supply the key is never overridden. */
export const PRODUCT_DEFAULTS = new Map<KnobSpec, unknown>([
  [SCORE_THRESHOLD, 0.5],
  [QUERY_EXPANSION, "off"],
]);

const UNPARSEABLE = Symbol("unparseable");

export function asRecord(value: unknown): Record<string, unknown> | undefined {
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

  const pinned = PRODUCT_DEFAULTS.has(spec);
  return {
    value,
    source,
    configured,
    envOverride: source === "env" ? String(rawEnv ?? "") : "",
    envVar: spec.envVar,
    // A product default changes what "restore the default" means for this
    // knob; it never changes the effective value of a keyless file.
    default: (pinned ? PRODUCT_DEFAULTS.get(spec) : spec.fallback) as T,
    pinned,
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

/** The pinned knobs no layer supplies yet, as a ready-to-write patch. A file
 * that already carries them yields `{}`, so initialising once is all it takes. */
export function recallTuningInitPatch(state: RecallTuningState): RecallTuningPatch {
  const patch: RecallTuningPatch = {};
  if (state.scoreThreshold.pinned && state.scoreThreshold.source === "default") patch.scoreThreshold = state.scoreThreshold.default;
  if (state.recallLimit.pinned && state.recallLimit.source === "default") patch.recallLimit = state.recallLimit.default;
  if (state.recallQueryExpansion.pinned && state.recallQueryExpansion.source === "default") patch.recallQueryExpansion = state.recallQueryExpansion.default;
  if (state.recallExcludeUris.pinned && state.recallExcludeUris.source === "default") patch.recallExcludeUris = state.recallExcludeUris.default;
  return patch;
}

export async function recallTuningView(
  path: string,
  options: { env?: RecallTuningEnv; loaded: RecallTuningState },
): Promise<RecallTuningView> {
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
