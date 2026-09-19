import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface OvcliConfigView {
  url: string;
  account: string;
  user: string;
  apiKeySet: boolean;
  apiKeyMasked: string;
}

export type OvcliLoadResult =
  | { kind: "missing"; config: OvcliConfigView }
  | { kind: "invalid-json"; message: string; config: OvcliConfigView }
  | { kind: "invalid-shape"; message: string; config: OvcliConfigView }
  | { kind: "ready"; config: OvcliConfigView; permissionWarning: boolean };

export interface OvcliConfigInput {
  url: string;
  account: string;
  user: string;
  /** Undefined preserves a previously stored user key. */
  apiKey?: string;
}

const EMPTY_CONFIG: OvcliConfigView = {
  url: "http://127.0.0.1:1933",
  account: "",
  user: "",
  apiKeySet: false,
  apiKeyMasked: "",
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function maskKey(value: string): string {
  if (value.length <= 4) return value === "" ? "" : "••••";
  return `${value.slice(0, 2)}…${value.slice(-3)}`;
}

function viewOf(value: Record<string, unknown>): OvcliConfigView {
  const apiKey = asString(value.api_key);
  return {
    url: asString(value.url) || EMPTY_CONFIG.url,
    account: asString(value.account) || asString(value.account_id),
    user: asString(value.user) || asString(value.user_id),
    apiKeySet: apiKey !== "",
    apiKeyMasked: maskKey(apiKey),
  };
}

function isUnsafeMode(mode: number): boolean {
  return (mode & 0o077) !== 0;
}

export function assertHttpEndpoint(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("OpenViking URL must be an absolute http(s) URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("OpenViking URL must be an absolute http(s) URL");
  }
  return parsed.toString().replace(/\/$/, "");
}

async function readStored(path: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("ovcli.conf must contain a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function loadOvcliUserKey(path: string): Promise<string> {
  const stored = await readStored(path);
  return asString(stored.api_key);
}

export async function loadOvcliConfig(path: string): Promise<OvcliLoadResult> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "missing", config: EMPTY_CONFIG };
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "invalid-json", message: "ovcli.conf is not valid JSON", config: EMPTY_CONFIG };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "invalid-shape", message: "ovcli.conf must contain a JSON object", config: EMPTY_CONFIG };
  }

  const info = await stat(path);
  return { kind: "ready", config: viewOf(parsed as Record<string, unknown>), permissionWarning: isUnsafeMode(info.mode) };
}

export async function saveOvcliConfig(path: string, input: OvcliConfigInput): Promise<OvcliConfigView> {
  const url = assertHttpEndpoint(input.url);
  const existing = await readStored(path);
  const existingKey = asString(existing.api_key);
  const apiKey = input.apiKey === undefined ? existingKey : input.apiKey.trim();
  const next: Record<string, unknown> = {
    ...existing,
    url,
    api_key: apiKey,
    account: input.account.trim(),
    user: input.user.trim(),
  };

  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  return viewOf(next);
}

export async function repairOvcliPermissions(path: string): Promise<void> {
  await chmod(path, 0o600);
}
