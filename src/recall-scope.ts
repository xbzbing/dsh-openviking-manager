import { readFileSync } from "node:fs";
import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";
import type { MemoryProject } from "./memory-project.js";

/** Config-face editing for the official recall peer-scope knob.
 *
 * The official memory plugin declares `recallPeerScope` (enum all|actor) in
 * `shared/config-schema.mjs`: `all` — its own default — searches every peer of
 * the current user, `actor` restricts automatic recall to the current project's
 * peer. This module only reads and writes ovcli.conf through the same layer
 * rules the plugin resolves and never implements recall itself:
 *
 *   env OPENVIKING_RECALL_PEER_SCOPE
 *   → workspace layers (config.json / config.local.json / machine registry)
 *   → ovcli.conf plugin.dsh
 *   → ovcli.conf plugin
 *   → official default `all`
 *
 * The workspace layers outrank anything written here, so a repository that
 * commits `.openviking/config.json` decides for everyone who clones it; the
 * view names that layer instead of pretending the file below it won.
 *
 * Writes are harness-scoped: this manager owns the DSH panel, so it writes
 * `plugin.dsh.recallPeerScope` and never the shared `plugin` section that every
 * other harness on the machine reads. The value is written explicitly even for
 * `all`, because deleting the key would fall back to a shared value another
 * harness may have set — the switch has to mean what it says.
 *
 * The plugin resolves its configuration once, when it applies, so a file change
 * is pending until the plugin reloads. `restartPending` reports that gap: the
 * snapshot `loadedScope` is the effective value at construction time (plugin
 * apply) and advances only after a successful plugin restart. */

export type RecallScope = "all" | "actor";
export type RecallScopeSource = "env" | "workspace" | "plugin.dsh" | "plugin" | "default";

export const RECALL_SCOPE_ENV = "OPENVIKING_RECALL_PEER_SCOPE";

export interface RecallScopeView {
  /** Effective value the official plugin honours right now. */
  scope: RecallScope;
  source: RecallScopeSource;
  /** Raw env value when the environment is the effective override. */
  envOverride: string;
  /** Workspace layer name when one supplied the value; "" otherwise. */
  workspaceLayer: string;
  /** What the shared `plugin` section says (the other harnesses); "" unset. */
  sharedScope: string;
  /** The file asks for a value the applied plugin has not loaded yet. */
  restartPending: boolean;
  /** The project this answer was resolved for. */
  project: MemoryProject;
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

export interface ScopeLayerOptions {
  /** The value a workspace layer declared, already validated. */
  workspaceScope?: unknown;
  /** The layer that declared it, for the view. */
  workspaceLayer?: string;
}

/** Resolve the effective scope the way resolveKnobs does: a valid env value
 * wins, then a workspace layer, then `plugin.dsh`, then `plugin`, then the
 * official default `all`. Invalid values are ignored rather than overriding
 * lower layers. */
export function effectiveRecallScope(
  config: Record<string, unknown>,
  env: RecallScopeEnv = {},
  options: ScopeLayerOptions = {},
): { scope: RecallScope; source: RecallScopeSource; envOverride: string; workspaceLayer: string } {
  const raw = env[RECALL_SCOPE_ENV]?.trim() ?? "";
  if (raw !== "") {
    const fromEnv = normalizeRecallScope(raw);
    if (fromEnv !== undefined) return { scope: fromEnv, source: "env", envOverride: raw, workspaceLayer: "" };
  }
  const fromWorkspace = normalizeRecallScope(options.workspaceScope);
  if (fromWorkspace !== undefined) {
    return {
      scope: fromWorkspace,
      source: "workspace",
      envOverride: "",
      workspaceLayer: options.workspaceLayer ?? "",
    };
  }
  const fromHarness = normalizeRecallScope(harnessSection(config)?.recallPeerScope);
  if (fromHarness !== undefined) return { scope: fromHarness, source: "plugin.dsh", envOverride: "", workspaceLayer: "" };
  const fromShared = normalizeRecallScope(pluginSection(config)?.recallPeerScope);
  if (fromShared !== undefined) return { scope: fromShared, source: "plugin", envOverride: "", workspaceLayer: "" };
  return { scope: "all", source: "default", envOverride: "", workspaceLayer: "" };
}

/** The shared `plugin` value, for the "other harnesses" note in the panel. */
export function sharedRecallScope(config: Record<string, unknown>): string {
  const value = pluginSection(config)?.recallPeerScope;
  return value === "all" || value === "actor" ? value : "";
}

/** Synchronous snapshot taken when the routes are constructed — the moment the
 * official plugin applied with this file. A missing or unparsable file means
 * the official default, never a thrown startup error. */
export function snapshotLoadedRecallScope(
  path: string,
  env: RecallScopeEnv = {},
  options: ScopeLayerOptions = {},
): RecallScope {
  let config: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      config = parsed as Record<string, unknown>;
    }
  } catch {
    config = {};
  }
  return effectiveRecallScope(config, env, options).scope;
}

/** Write the chosen scope to the DSH-scoped section, leaving every other key
 * and every other harness untouched. */
export async function saveRecallScope(path: string, scope: RecallScope): Promise<void> {
  const existing = await readOvcliObject(path);
  const shared = pluginSection(existing);
  if (existing.plugin !== undefined && shared === undefined) {
    throw new Error('ovcli.conf "plugin" section must be an object');
  }
  const nextShared: Record<string, unknown> = { ...(shared ?? {}) };
  const harness = sectionOf(nextShared.dsh) ?? {};
  nextShared.dsh = { ...harness, recallPeerScope: scope };
  await writeOvcliObject(path, { ...existing, plugin: nextShared });
}

export async function recallScopeView(
  path: string,
  options: { env?: RecallScopeEnv; loadedScope: RecallScope; project: MemoryProject },
): Promise<RecallScopeView> {
  const env = options.env ?? process.env;
  const config = await readOvcliObject(path);
  const declaration = options.project.declarations.find((item) => item.key === "recall.peer_scope");
  const effective = effectiveRecallScope(config, env, {
    workspaceScope: declaration?.value,
    workspaceLayer: declaration?.layer,
  });
  return {
    ...effective,
    sharedScope: sharedRecallScope(config),
    restartPending: effective.scope !== options.loadedScope,
    project: options.project,
  };
}
