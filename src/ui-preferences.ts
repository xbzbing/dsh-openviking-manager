import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** Display preferences owned by this manager, not by OpenViking. They live in
 * the plugin's own file under the DSH home rather than in ovcli.conf: that file
 * only carries keys the official plugin declares. */
export interface UiPreferences {
  /** Whether the composer shows the per-session OpenViking pill. Off by default:
   * the session toggle keeps working (and defaults to on) while hidden. */
  showInputToggle: boolean;
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = { showInputToggle: false };

export function resolveUiPreferencesPath(env: { [key: string]: string | undefined } = process.env): string {
  const home = env.DSH_HOME?.trim() || join(homedir(), ".dsh");
  return join(home, "plugin-data", "dsh-openviking-manager", "preferences.json");
}

async function readObject(path: string): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    // Missing or unreadable: a display preference falls back to its default
    // instead of breaking the composer.
    return {};
  }
}

export async function loadUiPreferences(path: string): Promise<UiPreferences> {
  const stored = await readObject(path);
  return {
    showInputToggle: typeof stored.showInputToggle === "boolean" ? stored.showInputToggle : DEFAULT_UI_PREFERENCES.showInputToggle,
  };
}

/** Validate a PUT body: only known keys with the right type are accepted. */
export function parseUiPreferencesPatch(body: unknown): Partial<UiPreferences> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("body must be a JSON object");
  const record = body as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter((key) => key !== "showInputToggle");
  if (unknownKeys.length > 0) throw new Error(`unknown preference: ${unknownKeys.join(", ")}`);
  if (typeof record.showInputToggle !== "boolean") throw new Error("showInputToggle must be a boolean");
  return { showInputToggle: record.showInputToggle };
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
