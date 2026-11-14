import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Preferences owned by this manager, not by OpenViking. They live in the
 * plugin's own file under the DSH home rather than in ovcli.conf: that file
 * only carries keys the official plugin declares. */
export interface UiPreferences {
  /** Whether the composer shows the per-session OpenViking pill. Off by default:
   * the session toggle keeps working (and defaults to on) while hidden. */
  showInputToggle: boolean;
  /** Whether the host hides the agent's explicit `mcp__openviking__remember`
   * tool. On by default: the tool has no peer argument, so an explicit call
   * writes to the user-level space. Automatic capture is never affected. */
  disableMcpRemember: boolean;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  showInputToggle: false,
  disableMcpRemember: true,
};

export function resolveUiPreferencesPath(env: { [key: string]: string | undefined } = process.env): string {
  const home = env.DSH_HOME?.trim() || join(homedir(), ".dsh");
  return join(home, "plugin-data", "dsh-openviking-manager", "preferences.json");
}

function normalizePreferences(stored: Record<string, unknown>): UiPreferences {
  return {
    showInputToggle: typeof stored.showInputToggle === "boolean" ? stored.showInputToggle : DEFAULT_UI_PREFERENCES.showInputToggle,
    disableMcpRemember: typeof stored.disableMcpRemember === "boolean" ? stored.disableMcpRemember : DEFAULT_UI_PREFERENCES.disableMcpRemember,
  };
}

async function readObject(path: string): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    // Missing or unreadable: a preference falls back to its default instead of
    // breaking the composer or the tool guard.
    return {};
  }
}

function readObjectSync(path: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function loadUiPreferences(path: string): Promise<UiPreferences> {
  return normalizePreferences(await readObject(path));
}

/** Startup read for the synchronous tool guard. The file is tiny (two booleans);
 * a missing or malformed file keeps the safety default: remember blocked. */
export function loadUiPreferencesSync(path: string): UiPreferences {
  return normalizePreferences(readObjectSync(path));
}

const PREFERENCE_KEYS = ["showInputToggle", "disableMcpRemember"] as const;

/** Validate a PUT body: only known keys with the right type are accepted. A
 * patch may carry either key or both; an empty object is not a no-op. */
export function parseUiPreferencesPatch(body: unknown): Partial<UiPreferences> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("body must be a JSON object");
  const record = body as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => !(PREFERENCE_KEYS as readonly string[]).includes(key));
  if (unknownKeys.length > 0) throw new Error(`unknown preference: ${unknownKeys.join(", ")}`);

  const patch: Partial<UiPreferences> = {};
  if ("showInputToggle" in record) {
    if (typeof record.showInputToggle !== "boolean") throw new Error("showInputToggle must be a boolean");
    patch.showInputToggle = record.showInputToggle;
  }
  if ("disableMcpRemember" in record) {
    if (typeof record.disableMcpRemember !== "boolean") throw new Error("disableMcpRemember must be a boolean");
    patch.disableMcpRemember = record.disableMcpRemember;
  }
  if (Object.keys(patch).length === 0) throw new Error("at least one preference is required");
  return patch;
}

/** Merge the patch into the stored object and replace the file atomically.
 * Keys a later version may add survive a write from this one. */
export async function saveUiPreferences(path: string, patch: Partial<UiPreferences>): Promise<UiPreferences> {
  const next = { ...(await readObject(path)), ...patch };
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(temporary, path);
  return loadUiPreferences(path);
}
