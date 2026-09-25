/** Config-face editing for the official actor peer id.
 *
 * The official memory plugin declares `peerId` (string, alias `peer_id`) in
 * `shared/config-schema.mjs`. It answers "which peer (topic) does this process
 * belong to", and is deliberately different from `recallPeerScope`, which
 * answers "how wide does recall search". Left empty — its official default —
 * the plugin derives a peer per session from that session's workspace git
 * identity, so every repository automatically becomes its own topic. A pinned
 * value is an escape hatch: it is process-level and outranks the per-session
 * derivation (official `resolveEffectivePeerId` short-circuits on an explicit
 * `cfg.peerId`), so all sessions then share that one peer.
 *
 * This module only reads and writes ovcli.conf's `plugin` section — the same
 * face the official loader reads through `resolveSettings`/`resolvePluginPeerId`
 * — where `plugin.peerId` ranks above the top-level `actor_peer_id` credential.
 * It never implements peer resolution itself and never invents a config key.
 *
 * Resolution mirrors `effectiveRecallScope`: `env` first (`OPENVIKING_PEER_ID`
 * outranks any file this plugin can write, so the UI must show the override
 * rather than let a file value pretend), then `plugin.dsh`, then `plugin`,
 * then the top-level `actor_peer_id`/`peer_id` credential (read-only here —
 * this plugin does not edit credential keys), then the official default of an
 * empty string, which means "derive per session from the workspace". The
 * `.openviking/config.json` workspace layer and `ov.conf` are not read: the
 * first is managed by hand and out of scope by contract, the second sits below
 * everything written here.
 *
 * The plugin resolves configuration once, at apply, so a file change is pending
 * until it reloads. `restartPending` reports that gap the same way the
 * isolation switch does. */
export type PeerIdSource = "env" | "plugin.dsh" | "plugin" | "ovcli" | "default";
export declare const PEER_ID_ENV = "OPENVIKING_PEER_ID";
export interface PeerIdView {
    /** Effective peer id the official plugin honours right now; "" means the
     * plugin derives one per session from the workspace (automatic isolation). */
    peerId: string;
    source: PeerIdSource;
    /** Raw env value when the environment is the effective override. */
    envOverride: string;
    /** A top-level `actor_peer_id`/`peer_id` credential this plugin does not
     * edit, when it is the effective source; "" otherwise. */
    ovcliOverride: string;
    /** The file asks for a value the applied plugin has not loaded yet. */
    restartPending: boolean;
}
export interface PeerIdEnv {
    [key: string]: string | undefined;
}
/** Normalize submitted input into a peer id or `undefined` for "clear it".
 * Throws on invalid input rather than storing a value the server would mangle. */
export declare function normalizePeerId(value: unknown): string | undefined;
/** Resolve the effective peer id the way the official chain does for the parts
 * this plugin can see: env → plugin.dsh → plugin → top-level credential →
 * default (""). */
export declare function effectivePeerId(config: Record<string, unknown>, env?: PeerIdEnv): {
    peerId: string;
    source: PeerIdSource;
    envOverride: string;
    ovcliOverride: string;
};
export declare function currentPeerId(path: string, env?: PeerIdEnv): Promise<string>;
/** Synchronous snapshot taken when the routes are constructed — the moment the
 * official plugin applied with this file. A missing or unparsable file means
 * the official default (auto per-session), never a thrown startup error. */
export declare function snapshotLoadedPeerId(path: string, env?: PeerIdEnv): string;
export declare function peerIdView(path: string, options: {
    env?: PeerIdEnv;
    loadedPeerId: string;
}): Promise<PeerIdView>;
/** Write the peer id to ovcli.conf's `plugin` section, mirroring the rules the
 * official loader reads by:
 *
 * - a value sets `plugin.peerId` after clearing any `plugin.dsh` override and
 *   the legacy `peer_id` alias in both sections, so one key is the single
 *   source of it;
 * - `undefined` (an empty submission) removes `peerId`/`peer_id` from both
 *   sections — an absent key *is* the official default, which restores the
 *   automatic per-session derivation this plugin never pins otherwise. It does
 *   not touch a top-level `actor_peer_id` credential: this plugin only edits
 *   the plugin section, and the view reports when such a key still pins.
 *
 * Every other key (credentials, sections, unknown entries) is preserved. */
export declare function savePeerId(path: string, peerId: string | undefined): Promise<void>;
