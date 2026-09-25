import { readFileSync } from "node:fs";
import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";
import { harnessSection, pluginSection } from "./recall-scope.js";

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

export const PEER_ID_ENV = "OPENVIKING_PEER_ID";

/** The server sanitizes a peer id; this plugin rejects only clearly invalid
 * input so a typo cannot silently turn into a different peer. Mirrors the
 * charset the official `sanitizePeerId` keeps, without the server's rewriting. */
const PEER_ID_RE = /^[A-Za-z0-9_.@-]+$/;
const MAX_PEER_ID_LENGTH = 100;

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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** A trimmed non-empty string, else undefined — the shape every layer reports. */
function stringValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** `plugin.peerId`, then its alias `plugin.peer_id`, within one section. */
function peerIdIn(section: Record<string, unknown> | undefined): string | undefined {
  if (section === undefined) return undefined;
  return stringValue(section.peerId) ?? stringValue(section.peer_id);
}

/** The top-level `actor_peer_id`/`peer_id` credential the official chain reads.
 * This plugin surfaces it read-only; it never writes a credential key. */
function credentialPeerId(config: Record<string, unknown>): string | undefined {
  return stringValue(config.actor_peer_id) ?? stringValue(config.peer_id);
}

/** Normalize submitted input into a peer id or `undefined` for "clear it".
 * Throws on invalid input rather than storing a value the server would mangle. */
export function normalizePeerId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("peerId must be a string");
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.length > MAX_PEER_ID_LENGTH) {
    throw new Error(`peerId must be at most ${MAX_PEER_ID_LENGTH} characters`);
  }
  if (!PEER_ID_RE.test(trimmed)) {
    throw new Error("peerId may only contain letters, digits, and the characters . _ @ -");
  }
  return trimmed;
}

/** Resolve the effective peer id the way the official chain does for the parts
 * this plugin can see: env → plugin.dsh → plugin → top-level credential →
 * default (""). */
export function effectivePeerId(
  config: Record<string, unknown>,
  env: PeerIdEnv = {},
): { peerId: string; source: PeerIdSource; envOverride: string; ovcliOverride: string } {
  const rawEnv = env[PEER_ID_ENV]?.trim() ?? "";
  if (rawEnv !== "") {
    return { peerId: rawEnv, source: "env", envOverride: rawEnv, ovcliOverride: "" };
  }
  const fromHarness = peerIdIn(harnessSection(config));
  if (fromHarness !== undefined) {
    return { peerId: fromHarness, source: "plugin.dsh", envOverride: "", ovcliOverride: "" };
  }
  const fromShared = peerIdIn(pluginSection(config));
  if (fromShared !== undefined) {
    return { peerId: fromShared, source: "plugin", envOverride: "", ovcliOverride: "" };
  }
  const fromCredential = credentialPeerId(config);
  if (fromCredential !== undefined) {
    return { peerId: fromCredential, source: "ovcli", envOverride: "", ovcliOverride: fromCredential };
  }
  return { peerId: "", source: "default", envOverride: "", ovcliOverride: "" };
}

export async function currentPeerId(path: string, env: PeerIdEnv = {}): Promise<string> {
  const config = await readOvcliObject(path);
  return effectivePeerId(config, env).peerId;
}

/** Synchronous snapshot taken when the routes are constructed — the moment the
 * official plugin applied with this file. A missing or unparsable file means
 * the official default (auto per-session), never a thrown startup error. */
export function snapshotLoadedPeerId(path: string, env: PeerIdEnv = {}): string {
  let config: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const record = asRecord(parsed);
    if (record !== undefined) config = record;
  } catch {
    config = {};
  }
  return effectivePeerId(config, env).peerId;
}

export async function peerIdView(
  path: string,
  options: { env?: PeerIdEnv; loadedPeerId: string },
): Promise<PeerIdView> {
  const env = options.env ?? process.env;
  const config = await readOvcliObject(path);
  const effective = effectivePeerId(config, env);
  return { ...effective, restartPending: effective.peerId !== options.loadedPeerId };
}

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
export async function savePeerId(path: string, peerId: string | undefined): Promise<void> {
  const existing = await readOvcliObject(path);
  const shared = pluginSection(existing);
  if (existing.plugin !== undefined && shared === undefined) {
    throw new Error('ovcli.conf "plugin" section must be an object');
  }
  const nextShared: Record<string, unknown> = { ...(shared ?? {}) };

  const harness = shared === undefined ? undefined : asRecord(shared.dsh);
  if (harness !== undefined && (Object.hasOwn(harness, "peerId") || Object.hasOwn(harness, "peer_id"))) {
    const { peerId: _peerId, peer_id: _peerIdAlias, ...rest } = harness;
    if (Object.keys(rest).length > 0) nextShared.dsh = rest;
    else delete nextShared.dsh;
  }

  // The legacy alias is retired whether we set or clear, so a stale spelling
  // cannot mask the new value.
  delete nextShared.peer_id;
  if (peerId !== undefined) nextShared.peerId = peerId;
  else delete nextShared.peerId;

  const next: Record<string, unknown> = { ...existing, plugin: nextShared };
  await writeOvcliObject(path, next);
}
