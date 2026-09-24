import { chmod, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
const EMPTY_CONFIG = {
    url: "http://127.0.0.1:1933",
    account: "",
    user: "",
    apiKeySet: false,
    apiKeyMasked: "",
};
function asString(value) {
    return typeof value === "string" ? value : "";
}
function maskKey(value) {
    if (value.length <= 4)
        return value === "" ? "" : "••••";
    return `${value.slice(0, 2)}…${value.slice(-3)}`;
}
function viewOf(value) {
    const apiKey = asString(value.api_key);
    return {
        url: asString(value.url) || EMPTY_CONFIG.url,
        account: asString(value.account) || asString(value.account_id),
        user: asString(value.user) || asString(value.user_id),
        apiKeySet: apiKey !== "",
        apiKeyMasked: maskKey(apiKey),
    };
}
function isUnsafeMode(mode) {
    return (mode & 0o077) !== 0;
}
export function assertHttpEndpoint(raw) {
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        throw new Error("OpenViking URL must be an absolute http(s) URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("OpenViking URL must be an absolute http(s) URL");
    }
    return parsed.toString().replace(/\/$/, "");
}
export async function readOvcliObject(path) {
    try {
        const raw = await readFile(path, "utf8");
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("ovcli.conf must contain a JSON object");
        }
        return parsed;
    }
    catch (error) {
        if (error.code === "ENOENT")
            return {};
        throw error;
    }
}
/** Atomically replace ovcli.conf with the caller's merged object, verbatim:
 * unknown keys written by other tools survive, and the 0600 mode is kept. */
export async function writeOvcliObject(path, next) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, path);
}
export async function loadOvcliUserKey(path) {
    const stored = await readOvcliObject(path);
    return asString(stored.api_key);
}
export async function loadOvcliConfig(path) {
    let raw;
    try {
        raw = await readFile(path, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return { kind: "missing", config: EMPTY_CONFIG };
        throw error;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return { kind: "invalid-json", message: "ovcli.conf is not valid JSON", config: EMPTY_CONFIG };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { kind: "invalid-shape", message: "ovcli.conf must contain a JSON object", config: EMPTY_CONFIG };
    }
    const info = await stat(path);
    return { kind: "ready", config: viewOf(parsed), permissionWarning: isUnsafeMode(info.mode) };
}
export async function saveOvcliConfig(path, input) {
    const url = assertHttpEndpoint(input.url);
    const existing = await readOvcliObject(path);
    const existingKey = asString(existing.api_key);
    const apiKey = input.apiKey === undefined ? existingKey : input.apiKey.trim();
    const next = {
        ...existing,
        url,
        api_key: apiKey,
        account: input.account.trim(),
        user: input.user.trim(),
    };
    await writeOvcliObject(path, next);
    return viewOf(next);
}
export async function repairOvcliPermissions(path) {
    await chmod(path, 0o600);
}
