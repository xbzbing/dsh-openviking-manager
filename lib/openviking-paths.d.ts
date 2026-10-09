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
/** Mirror the official `normalizePath`: `~` and `~/` expand against the home
 * directory and every other value resolves against the process cwd. */
export declare function normalizeConfigPath(value: unknown): string;
/**
 * Resolve the ovcli.conf and ov.conf paths the official plugin would use.
 * @param env - environment to read `OPENVIKING_CLI_CONFIG_FILE` and
 *   `OPENVIKING_CONFIG_FILE` from; defaults to `process.env`.
 * @param loadJson - candidate-file reader for the backward-compat shape check;
 *   defaults to a sync JSON read.
 */
export declare function resolveOpenVikingPaths(env?: OpenVikingPathEnv, loadJson?: JsonLoader): ResolvedOpenVikingPaths;
