import { readFileSync } from "node:fs";
import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";

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

export const RECALL_SCOPE_ENV = "OPENVIKING_RECALL_PEER_SCOPE";

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
export function normalizeRecallScope(value: unknown): RecallScope | undefined {
  return value === "all" || value === "actor" ? value : undefined;
}

function sectionOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function pluginSection(config: Record<string, unknown>): Record<string, unknown> | undefined {
  return sectionOf(config.plugin);
}

export function harnessSection(config: Record<string, unknown>, harness = "dsh"): Record<string, unknown> | undefined {
  const plugin = pluginSection(config);
  return plugin === undefined ? undefined : sectionOf(plugin[harness]);
}

/** Resolve the effective scope the way resolveKnobs does: a valid env value
 * wins, then `plugin.dsh`, then `plugin`, then the official default `all`.
 * Invalid values are ignored rather than overriding lower layers. */
export function effectiveRecallScope(
  config: Record<string, unknown>,
  env: RecallScopeEnv = {},
): { scope: RecallScope; source: RecallScopeSource; envOverride: string } {
  const raw = env[RECALL_SCOPE_ENV]?.trim() ?? "";
  if (raw !== "") {
    const fromEnv = normalizeRecallScope(raw);
    if (fromEnv !== undefined) return { scope: fromEnv, source: "env", envOverride: raw };
  }
  const fromHarness = normalizeRecallScope(harnessSection(config)?.recallPeerScope);
  if (fromHarness !== undefined) return { scope: fromHarness, source: "plugin.dsh", envOverride: "" };
  const fromShared = normalizeRecallScope(pluginSection(config)?.recallPeerScope);
  if (fromShared !== undefined) return { scope: fromShared, source: "plugin", envOverride: "" };
  return { scope: "all", source: "default", envOverride: "" };
}

export async function currentRecallScope(path: string, env: RecallScopeEnv = {}): Promise<RecallScope> {
  const config = await readOvcliObject(path);
  return effectiveRecallScope(config, env).scope;
}

/** Synchronous snapshot taken when the routes are constructed — the moment
 * the official plugin applied with this file. A missing or unparsable file
 * means the official default, never a thrown startup error. */
export function snapshotLoadedRecallScope(path: string, env: RecallScopeEnv = {}): RecallScope {
  let config: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      config = parsed as Record<string, unknown>;
    }
  } catch {
    config = {};
  }
  return effectiveRecallScope(config, env).scope;
}

export async function recallScopeView(
  path: string,
  options: { env?: RecallScopeEnv; loadedScope: RecallScope },
): Promise<RecallScopeView> {
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
export async function saveRecallScope(path: string, scope: RecallScope): Promise<void> {
  const existing = await readOvcliObject(path);
  const shared = pluginSection(existing);
  if (existing.plugin !== undefined && shared === undefined) {
    throw new Error('ovcli.conf "plugin" section must be an object');
  }
  const nextShared: Record<string, unknown> = { ...(shared ?? {}) };

  const harness = shared === undefined ? undefined : sectionOf(shared.dsh);
  if (harness !== undefined && Object.hasOwn(harness, "recallPeerScope")) {
    const { recallPeerScope: _removed, ...rest } = harness;
    if (Object.keys(rest).length > 0) nextShared.dsh = rest;
    else delete nextShared.dsh;
  }

  if (scope === "actor") {
    nextShared.recallPeerScope = "actor";
  } else {
    delete nextShared.recallPeerScope;
  }

  const next: Record<string, unknown> = { ...existing, plugin: nextShared };
  await writeOvcliObject(path, next);
}
