import { homedir } from "node:os";
import { join } from "node:path";
import { discoverLocalOpenViking } from "./local-discovery.js";
import { loadOvcliConfig, loadOvcliUserKey, repairOvcliPermissions, saveOvcliConfig } from "./ovcli-config.js";
import { currentRecallScope, normalizeRecallScope, recallScopeView, saveRecallScope, snapshotLoadedRecallScope, } from "./recall-scope.js";
import { currentPeerId, normalizePeerId, peerIdView, savePeerId, snapshotLoadedPeerId, } from "./recall-peer.js";
import { derivePeerId } from "./derive-peer.js";
import { currentRecallTuning, recallTuningView, snapshotLoadedRecallTuning, } from "./recall-tuning.js";
import { parseRecallTuningPatch, saveRecallTuning } from "./recall-tuning-persistence.js";
import { probeOpenViking } from "./openviking-client.js";
import { createAccount, createUser, listAccounts, listUsers, rotateUserKey } from "./openviking-admin.js";
import { isSessionOpenVikingEnabled, normalizeSessionId, setOpenVikingEnabled } from "./session-toggle.js";
import { checkLatestVersion, readVersionInfo } from "./version.js";
export const MANAGER_API_PREFIX = "/plugins/dsh-openviking-manager/api";
/** Sent when an admin operation is attempted before an OpenViking endpoint is saved. */
export const ENDPOINT_NOT_CONFIGURED_CODE = "endpoint-not-configured";
const MAX_BODY_BYTES = 32 * 1024;
const MAX_SESSION_ID_CHARS = 512;
function configPathOf(options) {
    return options.ovcliPath ?? join(homedir(), ".openviking", "ovcli.conf");
}
function ovconfPathOf(options) {
    return options.ovconfPath ?? join(homedir(), ".openviking", "ov.conf");
}
function writeJson(res, status, body) {
    res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff",
    });
    res.end(JSON.stringify(body));
}
async function readJson(req) {
    const chunks = [];
    let bytes = 0;
    for await (const item of req) {
        const chunk = item;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES)
            throw new Error("request body is too large");
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function stringAt(value, key) {
    if (typeof value !== "object" || value === null)
        return undefined;
    const item = value[key];
    return typeof item === "string" ? item : undefined;
}
function requiredString(value, key) {
    const item = stringAt(value, key)?.trim();
    if (item === undefined || item === "")
        throw new Error(`${key} must be a non-empty string`);
    return item;
}
function isSameOrigin(req) {
    const host = req.headers.host;
    const origin = req.headers.origin;
    if (typeof host !== "string" || origin === undefined)
        return true;
    try {
        return new URL(origin).host === host;
    }
    catch {
        return false;
    }
}
function rejectCrossOrigin(req, res) {
    if (isSameOrigin(req))
        return false;
    writeJson(res, 403, { error: "same-origin requests only" });
    return true;
}
export function makeManagerRoutes(options = {}) {
    const ovcliPath = configPathOf(options);
    const ovconfPath = ovconfPathOf(options);
    const env = options.env ?? process.env;
    // The official plugin resolves its config once at apply; constructing these
    // routes happens at apply too, so this snapshot is the value it loaded. It
    // only advances after a successful plugin restart.
    let loadedScope = snapshotLoadedRecallScope(ovcliPath, env);
    let loadedTuning = snapshotLoadedRecallTuning(ovcliPath, env);
    let loadedPeerId = snapshotLoadedPeerId(ovcliPath, env);
    let restarting = false;
    const scopeView = () => recallScopeView(ovcliPath, { env, loadedScope });
    const tuningView = () => recallTuningView(ovcliPath, { env, loaded: loadedTuning });
    const peerView = () => peerIdView(ovcliPath, { env, loadedPeerId });
    return [
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/discovery`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method !== "GET") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    writeJson(res, 200, { ok: true, value: await discoverLocalOpenViking({ ovcliPath, ovconfPath }) });
                }
                catch (error) {
                    writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to discover local OpenViking configuration" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/config`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method === "GET") {
                    try {
                        writeJson(res, 200, { ok: true, value: await loadOvcliConfig(ovcliPath) });
                    }
                    catch (error) {
                        writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to read ovcli.conf" });
                    }
                    return;
                }
                if (req.method !== "PUT") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    const body = await readJson(req);
                    const url = stringAt(body, "url");
                    const account = stringAt(body, "account");
                    const user = stringAt(body, "user");
                    const apiKey = stringAt(body, "apiKey");
                    if (url === undefined || account === undefined || user === undefined) {
                        writeJson(res, 400, { error: "url, account, and user must be strings" });
                        return;
                    }
                    const config = await saveOvcliConfig(ovcliPath, { url, account, user, ...(apiKey === undefined ? {} : { apiKey }) });
                    writeJson(res, 200, { ok: true, value: { kind: "ready", config, permissionWarning: false } });
                }
                catch (error) {
                    writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save ovcli.conf" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/probe`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method !== "POST") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    const current = await loadOvcliConfig(ovcliPath);
                    if (current.kind !== "ready") {
                        writeJson(res, 409, { ok: false, error: "A valid ovcli.conf is required before connection verification" });
                        return;
                    }
                    const body = await readJson(req);
                    const suppliedKey = stringAt(body, "apiKey");
                    const apiKey = suppliedKey === undefined || suppliedKey === "" ? await loadOvcliUserKey(ovcliPath) : suppliedKey;
                    const probe = await probeOpenViking({
                        url: current.config.url,
                        apiKey,
                        account: current.config.account,
                        user: current.config.user,
                    });
                    writeJson(res, 200, { ok: true, value: probe });
                }
                catch (error) {
                    writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to verify OpenViking connection" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/admin`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method !== "POST") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    const body = await readJson(req);
                    const operation = requiredString(body, "operation");
                    const rootApiKey = requiredString(body, "rootApiKey");
                    const current = await loadOvcliConfig(ovcliPath);
                    const endpoint = current.kind === "ready" ? current.config.url : stringAt(body, "url")?.trim();
                    if (endpoint === undefined || endpoint === "") {
                        writeJson(res, 409, { ok: false, code: ENDPOINT_NOT_CONFIGURED_CODE, error: "Save the OpenViking endpoint before running this management operation" });
                        return;
                    }
                    if (operation === "accounts") {
                        writeJson(res, 200, { ok: true, value: { operation, accounts: await listAccounts(endpoint, rootApiKey) } });
                        return;
                    }
                    const accountId = requiredString(body, "accountId");
                    if (operation === "users") {
                        writeJson(res, 200, { ok: true, value: { operation, users: await listUsers(endpoint, rootApiKey, accountId) } });
                        return;
                    }
                    const userId = requiredString(body, "userId");
                    if (operation === "create-account") {
                        const created = await createAccount(endpoint, rootApiKey, accountId, userId);
                        writeJson(res, 200, { ok: true, value: { operation, created } });
                        return;
                    }
                    if (operation === "create-user") {
                        const created = await createUser(endpoint, rootApiKey, accountId, userId);
                        writeJson(res, 200, { ok: true, value: { operation, created } });
                        return;
                    }
                    if (operation === "rotate-user-key") {
                        const userKey = await rotateUserKey(endpoint, rootApiKey, accountId, userId);
                        writeJson(res, 200, { ok: true, value: { operation, userKey } });
                        return;
                    }
                    writeJson(res, 400, { ok: false, error: "unsupported admin operation" });
                }
                catch (error) {
                    writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "OpenViking admin request failed" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/session-toggle`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method === "GET") {
                    const url = new URL(req.url ?? "/", "http://localhost");
                    const sessionId = normalizeSessionId(url.searchParams.get("sessionId"));
                    if (sessionId === undefined || sessionId.length > MAX_SESSION_ID_CHARS) {
                        writeJson(res, 400, { ok: false, error: "sessionId must be a non-empty string" });
                        return;
                    }
                    writeJson(res, 200, { ok: true, value: { sessionId, enabled: isSessionOpenVikingEnabled(sessionId) } });
                    return;
                }
                if (req.method !== "PUT") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    const body = await readJson(req);
                    const sessionId = normalizeSessionId(stringAt(body, "sessionId"));
                    if (sessionId === undefined || sessionId.length > MAX_SESSION_ID_CHARS) {
                        writeJson(res, 400, { ok: false, error: "sessionId must be a non-empty string" });
                        return;
                    }
                    if (typeof body.enabled !== "boolean") {
                        writeJson(res, 400, { ok: false, error: "enabled must be a boolean" });
                        return;
                    }
                    setOpenVikingEnabled(sessionId, body.enabled);
                    writeJson(res, 200, { ok: true, value: { sessionId, enabled: isSessionOpenVikingEnabled(sessionId) } });
                }
                catch (error) {
                    writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to update the session toggle" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/repair-permissions`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method !== "POST") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    await repairOvcliPermissions(ovcliPath);
                    writeJson(res, 200, { ok: true, value: await loadOvcliConfig(ovcliPath) });
                }
                catch (error) {
                    writeJson(res, 403, { ok: false, error: error instanceof Error ? error.message : "Unable to repair file permissions" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/version`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method !== "GET") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                // A remote check only runs when the caller explicitly asks for it;
                // the default GET stays offline and returns the local version view.
                const url = new URL(req.url ?? "/", "http://localhost");
                const wantsRemote = url.searchParams.get("check") === "1";
                try {
                    const value = wantsRemote ? await checkLatestVersion() : await readVersionInfo();
                    writeJson(res, 200, { ok: true, value });
                }
                catch (error) {
                    writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to read version information" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/recall-scope`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method === "GET") {
                    try {
                        writeJson(res, 200, { ok: true, value: await scopeView() });
                    }
                    catch (error) {
                        writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to read the memory isolation setting" });
                    }
                    return;
                }
                if (req.method !== "PUT") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    const body = await readJson(req);
                    const scope = normalizeRecallScope(stringAt(body, "scope"));
                    if (scope === undefined) {
                        writeJson(res, 400, { ok: false, error: 'scope must be "all" or "actor"' });
                        return;
                    }
                    await saveRecallScope(ovcliPath, scope);
                    writeJson(res, 200, { ok: true, value: await scopeView() });
                }
                catch (error) {
                    writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save the memory isolation setting" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/recall-tuning`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method === "GET") {
                    try {
                        writeJson(res, 200, { ok: true, value: await tuningView() });
                    }
                    catch (error) {
                        writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to read the recall tuning settings" });
                    }
                    return;
                }
                if (req.method !== "PUT") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    // Only official keys, only through the official config face, and only
                    // after the value domain of config-schema has been checked.
                    const patch = parseRecallTuningPatch(await readJson(req));
                    await saveRecallTuning(ovcliPath, patch);
                    writeJson(res, 200, { ok: true, value: await tuningView() });
                }
                catch (error) {
                    writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save the recall tuning settings" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/recall-peer`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method === "GET") {
                    try {
                        writeJson(res, 200, { ok: true, value: await peerView() });
                    }
                    catch (error) {
                        writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to read the actor peer id" });
                    }
                    return;
                }
                if (req.method !== "PUT") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    // Only the official `plugin.peerId` key, and only after the value has
                    // been validated against the server's peer-id charset.
                    const body = await readJson(req);
                    const peerId = normalizePeerId(stringAt(body, "peerId"));
                    await savePeerId(ovcliPath, peerId);
                    writeJson(res, 200, { ok: true, value: await peerView() });
                }
                catch (error) {
                    writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save the actor peer id" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/recall-peer/derive`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method !== "GET") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                try {
                    writeJson(res, 200, { ok: true, value: await derivePeerId() });
                }
                catch (error) {
                    writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to derive the peer id" });
                }
            },
        },
        {
            kind: "exact",
            path: `${MANAGER_API_PREFIX}/recall-scope/restart`,
            handler: async (req, res) => {
                if (rejectCrossOrigin(req, res))
                    return;
                if (req.method !== "POST") {
                    writeJson(res, 405, { error: "method not allowed" });
                    return;
                }
                if (restarting) {
                    writeJson(res, 409, { ok: false, code: "restart-in-progress", error: "A plugin restart is already running" });
                    return;
                }
                if (!options.restartMemoryPlugin) {
                    writeJson(res, 200, { ok: true, value: { restarted: false, count: 0, reason: "plugin-unavailable" } });
                    return;
                }
                restarting = true;
                try {
                    const result = await options.restartMemoryPlugin();
                    // A successful restart re-applied the plugin, so whatever the file
                    // says now is the value it loaded — for the isolation scope and the
                    // recall tuning knobs alike: one reload picks up every key.
                    if (result.restarted) {
                        loadedScope = await currentRecallScope(ovcliPath, env);
                        loadedTuning = await currentRecallTuning(ovcliPath, env);
                        loadedPeerId = await currentPeerId(ovcliPath, env);
                    }
                    writeJson(res, 200, { ok: true, value: result });
                }
                catch (error) {
                    writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to restart the official memory plugin" });
                }
                finally {
                    restarting = false;
                }
            },
        },
    ];
}
