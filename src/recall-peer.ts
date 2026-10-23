import { readFileSync } from "node:fs";
import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";
import { harnessSection, pluginSection } from "./recall-scope.js";
import type { MemoryProject } from "./memory-project.js";

/** Config-face editing for the official peer pin.
 *
 * `peerId` (alias `peer_id`) in `shared/config-schema.mjs` answers "which peer
 * does this session belong to". Left empty — its official default — the plugin
 * derives one per session from the session's workspace git identity, which is
 * what makes one project one memory namespace across clones, worktrees, agents
 * and machines. A pinned value is an escape hatch for directories no git
 * identity can describe: it is process-level and outranks the per-session
 * derivation, so *every* project on this machine then shares that one peer.
 * The panel therefore presents the pin as an advanced override with that cost
 * spelled out; the derived per-project peer is shown read-only.
 *
 * Resolution order (the official loader's, minus the workspace layers, which
 * the caller resolves through `readMemoryProject`):
 *
 *   env OPENVIKING_PEER_ID
 *   → ovcli.conf plugin.dsh
 *   → ovcli.conf plugin
 *   → the top-level `actor_peer_id`/`peer_id` credential (read-only here)
 *   → "" (derive per session)
 *
 * Workspace layers outrank all of these, so a repository that commits
 * `.openviking/config.json` with `peer.id` decides for everyone who clones it;
 * `readMemoryProject` reports that separately instead of merging it here. */

export type PeerIdSource = "env" | "plugin.dsh" | "plugin" | "ovcli" | "default";

export const PEER_ID_ENV = "OPENVIKING_PEER_ID";

/** The server sanitizes a peer id; this plugin rejects only clearly invalid
 * input so a typo cannot silently turn into a different peer. Mirrors the
 * charset the official `sanitizePeerId` keeps, without the server's rewriting. */
const PEER_ID_RE = /^[A-Za-z0-9_.@-]+$/;
const MAX_PEER_ID_LENGTH = 100;
/** The server's namespace for externally encoded identities (v0.5.2 uses
 * `ext-<base64>` for lossless mixed-script peers). A user value occupying that
 * prefix would be rewritten by the official `sanitizePeerId` to `x-ext-…`,
 * silently landing in a different namespace than the one displayed. */
const RESERVED_PREFIX = "ext-";

export interface PeerIdView {
  /** The pin the official plugin honours right now; "" means it derives one
   * per session from the workspace (the isolation model's normal state). */
  peerId: string;
  source: PeerIdSource;
  /** Raw env value when the environment is the effective override. */
  envOverride: string;
  /** A top-level `actor_peer_id`/`peer_id` credential this plugin does not
   * edit, when it is the effective source; "" otherwise. */
  ovcliOverride: string;
  /** What the shared `plugin` section pins for the other harnesses; "" unset. */
  sharedPeerId: string;
  /** The file asks for a value the applied plugin has not loaded yet. */
  restartPending: boolean;
  /** The project this answer was resolved for. */
  project: MemoryProject;
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
  if (trimmed.toLowerCase().startsWith(RESERVED_PREFIX)) {
    throw new Error(`peerId must not start with "${RESERVED_PREFIX}": the server reserves that prefix for externally encoded identities`);
  }
  if (!PEER_ID_RE.test(trimmed)) {
    throw new Error("peerId may only contain letters, digits, and the characters . _ @ -");
  }
  return trimmed;
}

/** Resolve the pin visible below the workspace layers: env → plugin.dsh →
 * plugin → top-level credential → default (""). */
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
  options: { env?: PeerIdEnv; loadedPeerId: string; project: MemoryProject },
): Promise<PeerIdView> {
  const env = options.env ?? process.env;
  const config = await readOvcliObject(path);
  const effective = effectivePeerId(config, env);
  return {
    ...effective,
    sharedPeerId: peerIdIn(pluginSection(config)) ?? "",
    restartPending: effective.peerId !== options.loadedPeerId,
    project: options.project,
  };
}

/** Write the pin to ovcli.conf's `plugin.dsh` section. The shared `plugin`
 * section belongs to every harness on the machine and is left alone, except
 * for one migration case: clearing the pin also retires a shared `peerId`,
 * because a leftover shared value would silently keep every session pinned and
 * make "automatic per-project derivation" a promise the file breaks.
 *
 * Every other key (credentials, sections, unknown entries) is preserved. */
export async function savePeerId(path: string, peerId: string | undefined): Promise<void> {
  const existing = await readOvcliObject(path);
  const shared = pluginSection(existing);
  if (existing.plugin !== undefined && shared === undefined) {
    throw new Error('ovcli.conf "plugin" section must be an object');
  }
  const nextShared: Record<string, unknown> = { ...(shared ?? {}) };
  const harness = asRecord(nextShared.dsh) ?? {};
  const { peerId: _peerId, peer_id: _peerIdAlias, ...rest } = harness;
  const nextHarness: Record<string, unknown> = peerId === undefined ? rest : { ...rest, peerId };
  if (Object.keys(nextHarness).length > 0) nextShared.dsh = nextHarness;
  else delete nextShared.dsh;

  if (peerId === undefined) {
    delete nextShared.peerId;
    delete nextShared.peer_id;
  }

  await writeOvcliObject(path, { ...existing, plugin: nextShared });
}
