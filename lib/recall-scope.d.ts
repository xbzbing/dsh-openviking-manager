/** Config-face editing for the official recall peer-scope knob.
 *
 * The official memory plugin declares `recallPeerScope` (enum all|actor) in
 * `shared/config-schema.mjs`: `all` — its own default — searches every peer
 * of the current user, `actor` restricts automatic recall to the current
 * peer's memories. This module only reads and writes ovcli.conf through the
 * same layer rules the plugin resolves (`env` → `plugin.<harness>` →
 * `plugin` → default) and never implements recall itself.
 *
 * The plugin resolves that configuration once, when it applies, so a file
 * change is pending until the plugin reloads. `restartPending` reports that
 * gap: the snapshot `loadedScope` is the effective value at construction
 * time (plugin apply) and advances only after a successful plugin restart. */
export type RecallScope = "all" | "actor";
export type RecallScopeSource = "env" | "plugin.dsh" | "plugin" | "default";
export declare const RECALL_SCOPE_ENV = "OPENVIKING_RECALL_PEER_SCOPE";
export interface RecallScopeView {
    /** Effective value the official plugin honours right now. */
    scope: RecallScope;
    source: RecallScopeSource;
    /** Raw env value when the environment is the effective override. */
    envOverride: string;
    /** The file asks for a value the applied plugin has not loaded yet. */
    restartPending: boolean;
}
export interface RecallScopeEnv {
    [key: string]: string | undefined;
}
/** `undefined` for anything outside the official enum, matching
 * coerceKnobValue's "an unparseable layer is ignored" behaviour. */
export declare function normalizeRecallScope(value: unknown): RecallScope | undefined;
export declare function pluginSection(config: Record<string, unknown>): Record<string, unknown> | undefined;
export declare function harnessSection(config: Record<string, unknown>, harness?: string): Record<string, unknown> | undefined;
/** Resolve the effective scope the way resolveKnobs does: a valid env value
 * wins, then `plugin.dsh`, then `plugin`, then the official default `all`.
 * Invalid values are ignored rather than overriding lower layers. */
export declare function effectiveRecallScope(config: Record<string, unknown>, env?: RecallScopeEnv): {
    scope: RecallScope;
    source: RecallScopeSource;
    envOverride: string;
};
export declare function currentRecallScope(path: string, env?: RecallScopeEnv): Promise<RecallScope>;
/** Synchronous snapshot taken when the routes are constructed — the moment
 * the official plugin applied with this file. A missing or unparsable file
 * means the official default, never a thrown startup error. */
export declare function snapshotLoadedRecallScope(path: string, env?: RecallScopeEnv): RecallScope;
export declare function recallScopeView(path: string, options: {
    env?: RecallScopeEnv;
    loadedScope: RecallScope;
}): Promise<RecallScopeView>;
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
export declare function saveRecallScope(path: string, scope: RecallScope): Promise<void>;
