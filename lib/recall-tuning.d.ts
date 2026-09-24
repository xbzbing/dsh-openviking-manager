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
export type RecallTuningEnv = {
    [key: string]: string | undefined;
};
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
export declare const RECALL_TUNING_ENV_VARS: readonly string[];
/** The four knobs resolved through env → plugin.dsh → plugin → default. */
export declare function effectiveRecallTuning(config: Record<string, unknown>, env?: RecallTuningEnv): RecallTuningState;
/** Synchronous snapshot taken when the routes are constructed — the moment the
 * official plugin applied with this file. A missing or unparsable file means
 * the official defaults, never a thrown startup error. */
export declare function snapshotLoadedRecallTuning(path: string, env?: RecallTuningEnv): RecallTuningState;
export declare function currentRecallTuning(path: string, env?: RecallTuningEnv): Promise<RecallTuningState>;
export declare function recallTuningPending(current: RecallTuningState, loaded: RecallTuningState): boolean;
export declare function recallTuningView(path: string, options: {
    env?: RecallTuningEnv;
    loaded: RecallTuningState;
}): Promise<RecallTuningView>;
/** Validate a PUT body into a patch. Unknown keys are ignored; a missing key
 * leaves that knob untouched, which is what makes a partial save safe. */
export declare function parseRecallTuningPatch(raw: unknown): RecallTuningPatch;
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
export declare function saveRecallTuning(path: string, patch: RecallTuningPatch): Promise<void>;
