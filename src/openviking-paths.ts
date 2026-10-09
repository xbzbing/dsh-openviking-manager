/** Resolve the ovcli.conf and ov.conf paths the official OpenViking plugin
 * actually reads for a given environment, so this manager edits the same file
 * the running `@openviking/dsh-memory-plugin` loads.
 *
 * The official resolution lives in that package's `shared/credentials.mjs`
 * (`loadCredentialFiles`): `OPENVIKING_CLI_CONFIG_FILE` selects ovcli.conf and
 * `OPENVIKING_CONFIG_FILE` selects ov.conf, each falling back to the default
 * under `~/.openviking`. One backward-compat quirk survives from older installs
 * that pointed `OPENVIKING_CONFIG_FILE` at an ovcli-shaped file: when only
 * `OPENVIKING_CONFIG_FILE` is set and that file carries ovcli credential fields
 * (and no `server` section), it is treated as ovcli.conf and ov.conf falls back
 * to its default. OpenViking server v0.5.0 (#5551) makes
 * `OPENVIKING_CLI_CONFIG_FILE` the canonical selector across `ov status` /
 * `ov config`, so this manager must honour the same chain or it would silently
 * edit a different file than the plugin reads.
 *
 * This module only derives paths; it reads a candidate file solely to run the
 * official shape heuristic and never logs or returns its contents. */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

export interface OpenVikingPathEnv {
  [key: string]: string | undefined;
}

export interface ResolvedOpenVikingPaths {
  /** Absolute ovcli.conf path the official plugin reads/writes for this env. */
  ovcliPath: string;
  /** Absolute ov.conf path the official plugin reads for this env. */
  ovconfPath: string;
}

/** Injectable loader so unit tests stay hermetic; defaults to a sync JSON read
 * that returns null for anything unreadable or malformed (matching the
 * official `tryLoadJson`). */
export type JsonLoader = (path: string) => unknown;

function defaultOvcliPath(): string {
  return join(homedir(), ".openviking", "ovcli.conf");
}

function defaultOvconfPath(): string {
  return join(homedir(), ".openviking", "ov.conf");
}

/** Trim to a non-empty string, else "" — the official `str(val, "")`. */
function trimmed(value: unknown): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "";
}

/** Mirror the official `normalizePath`: `~` and `~/` expand against the home
 * directory and every other value resolves against the process cwd. */
export function normalizeConfigPath(value: unknown): string {
  const raw = trimmed(value);
  if (raw === "") return "";
  if (raw === "~") return homedir();
  if (raw.startsWith("~/")) return resolvePath(join(homedir(), raw.slice(2)));
  return resolvePath(raw);
}

function defaultLoader(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    return null;
  }
}

/** The official `looksLikeOvcli`: an object with no `server` section that
 * carries at least one ovcli credential field. A `server` section marks the
 * file as ov.conf and disqualifies it. */
function looksLikeOvcli(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if (obj.server !== undefined && typeof obj.server === "object" && obj.server !== null) return false;
  const fields = ["url", "api_key", "account", "account_id", "user", "user_id", "actor_peer_id"];
  return fields.some((key) => typeof obj[key] === "string");
}

/**
 * Resolve the ovcli.conf and ov.conf paths the official plugin would use.
 * @param env - environment to read `OPENVIKING_CLI_CONFIG_FILE` and
 *   `OPENVIKING_CONFIG_FILE` from; defaults to `process.env`.
 * @param loadJson - candidate-file reader for the backward-compat shape check;
 *   defaults to a sync JSON read.
 */
export function resolveOpenVikingPaths(
  env: OpenVikingPathEnv = process.env,
  loadJson: JsonLoader = defaultLoader,
): ResolvedOpenVikingPaths {
  const cliCandidate = normalizeConfigPath(env.OPENVIKING_CLI_CONFIG_FILE) || defaultOvcliPath();
  const ovCandidate = normalizeConfigPath(env.OPENVIKING_CONFIG_FILE) || defaultOvconfPath();
  const cliSet = trimmed(env.OPENVIKING_CLI_CONFIG_FILE) !== "";
  const ovSet = trimmed(env.OPENVIKING_CONFIG_FILE) !== "";

  // Backward compat: OPENVIKING_CONFIG_FILE alone, pointing at an ovcli-shaped
  // file, serves as ovcli.conf and leaves ov.conf at its default.
  if (ovSet && !cliSet && looksLikeOvcli(loadJson(ovCandidate))) {
    return { ovcliPath: ovCandidate, ovconfPath: defaultOvconfPath() };
  }
  return { ovcliPath: cliCandidate, ovconfPath: ovCandidate };
}
