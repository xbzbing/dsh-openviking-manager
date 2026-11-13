import type { IncomingMessage, ServerResponse } from "node:http";
import { isAbsolute, resolve as resolvePath } from "node:path";
import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
import { resolveOpenVikingPaths } from "./openviking-paths.js";
import { credentialIsLocalRootKey, discoverLocalOpenViking, readOvconfDshSection } from "./local-discovery.js";
import { loadOvcliConfig, loadOvcliUserKey, readOvcliObject, repairOvcliPermissions, saveOvcliConfig } from "./ovcli-config.js";
import {
  normalizeRecallScope,
  recallScopeView,
  saveRecallScope,
  snapshotLoadedRecallScope,
  type RecallScopeEnv,
} from "./recall-scope.js";
import {
  effectivePeerId,
  normalizePeerId,
  peerIdView,
  savePeerId,
  snapshotLoadedPeerId,
} from "./recall-peer.js";
import { readMemoryProject, type MemoryProject } from "./memory-project.js";
import {
  normalizePeerSource,
  peerSourceView,
  savePeerSource,
} from "./peer-source.js";
import {
  recallTuningView,
  snapshotLoadedRecallTuning,
  type WorkspaceKnobValues,
} from "./recall-tuning.js";
import { parseRecallTuningPatch, saveRecallTuning } from "./recall-tuning-persistence.js";
import type { RestartResult } from "./openviking-restart.js";
import { probeOpenViking } from "./openviking-client.js";
import { createAccount, createUser, listAccounts, listUsers, rotateUserKey } from "./openviking-admin.js";
import { isSessionOpenVikingEnabled, normalizeSessionId, setOpenVikingEnabled } from "./session-toggle.js";
import { isRequestAllowed, normalizedAllowedHosts } from "./http-security.js";
import { checkLatestVersion, readVersionInfo } from "./version.js";
import {
  loadUiPreferences,
  parseUiPreferencesPatch,
  resolveUiPreferencesPath,
  saveUiPreferences,
  type UiPreferences,
} from "./ui-preferences.js";

export const MANAGER_API_PREFIX = "/plugins/dsh-openviking-manager/api";
/** Sent when an admin operation is attempted before an OpenViking endpoint is saved. */
export const ENDPOINT_NOT_CONFIGURED_CODE = "endpoint-not-configured";
/** The exclude list alone can carry 100 × 512-character URIs (~51 KiB), so a
 * 32 KiB cap made the parser's own maximum unreachable. */
const MAX_BODY_BYTES = 64 * 1024;
const MAX_SESSION_ID_CHARS = 512;
const MAX_CWD_CHARS = 4096;
/** How long a plugin restart may take before the route answers anyway. A
 * fiber restart that neither resolves nor rejects would leave the panel on
 * "reloading" with every control disabled, so the request has to end. */
const RESTART_TIMEOUT_MS = 30_000;
/** Each workspace costs one git identity resolution plus a workspace-layer
 * read, so the list is bounded rather than unbounded work per request. */
const MAX_WORKSPACES = 64;
/** The directory the plugin process resolved its config for, i.e. the project
 * whose workspace layers the applied plugin actually loaded. */
const HOST_CWD = process.cwd();

export interface ManagerApiOptions {
  ovcliPath?: string;
  ovconfPath?: string;
  /** Host-injected reload of the official memory plugin. Absent means the
   * official plugin cannot be restarted in this process (optional peer); the
   * restart route then reports `plugin-unavailable` instead of failing. */
  restartMemoryPlugin?: () => Promise<RestartResult>;
  /** Override the restart budget; tests use a value in the millisecond range. */
  restartTimeoutMs?: number;
  /** The sidebar workspaces, as absolute paths. Supplied by the host from
   * `ctx.workspaceRegistry.list()`; `undefined` means "this host cannot
   * enumerate them", and the panel then hides the section instead of
   * pretending the list is empty. */
  workspacePaths?: () => string[] | undefined;
  /** Env layer for the recall-scope view and for resolving which ovcli.conf /
   * ov.conf the official plugin reads; defaults to process.env. Tests pass an
   * explicit object so a machine-level OPENVIKING_* variable cannot leak into
   * assertions. An explicit `ovcliPath` / `ovconfPath` still wins over the env
   * resolution, keeping path-injecting tests fully hermetic. */
  env?: RecallScopeEnv;
  /** This manager's own preferences file; defaults to
   * `$DSH_HOME/plugin-data/dsh-openviking-manager/preferences.json`. */
  preferencesPath?: string;
  /** Called after a preferences save so the host can apply the MCP remember
   * policy to its synchronous tool guard without restarting the plugin. */
  onPreferencesSaved?: (preferences: UiPreferences) => void;
  /** Authorities (host names, optionally with a port) this process serves in
   * addition to loopback. The host passes its own bound origin here; a reverse
   * proxy deployment can add its public name through
   * `DSH_OPENVIKING_MANAGER_ALLOWED_HOSTS`. A request whose Host is neither
   * loopback nor listed is refused: accepting any Host would let a DNS
   * rebinding page reach these routes with the browser's same-origin
   * privileges and read the masked key / write the endpoint. */
  allowedHosts?: string[];
}

/** Resolve the two config paths this manager operates on. An explicitly
 * supplied path always wins (test injection); otherwise the paths follow the
 * official plugin's `OPENVIKING_CLI_CONFIG_FILE` / `OPENVIKING_CONFIG_FILE`
 * chain so the UI edits the same file the running plugin loads. */
function resolvePaths(options: ManagerApiOptions, env: RecallScopeEnv): { ovcliPath: string; ovconfPath: string } {
  if (options.ovcliPath !== undefined && options.ovconfPath !== undefined) {
    return { ovcliPath: options.ovcliPath, ovconfPath: options.ovconfPath };
  }
  const resolved = resolveOpenVikingPaths(env);
  return {
    ovcliPath: options.ovcliPath ?? resolved.ovcliPath,
    ovconfPath: options.ovconfPath ?? resolved.ovconfPath,
  };
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const item of req) {
    const chunk = item as Buffer;
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function stringAt(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : undefined;
}

function requiredString(value: unknown, key: string): string {
  const item = stringAt(value, key)?.trim();
  if (item === undefined || item === "") throw new Error(`${key} must be a non-empty string`);
  return item;
}

/** One sidebar workspace, resolved: the peer its sessions will use, and
 * whether that namespace is shared with another workspace in the list. */
export interface WorkspaceSummary {
  path: string;
  workspaceRoot: string;
  peer: string;
  peerOrigin: string;
  /** Other workspaces that resolve to the same peer (their paths). */
  sharedWith: string[];
  /** The peer is empty, so this workspace lands in the user-level space that
   * every directory without a peer shares. */
  userLevelSpace: boolean;
  /** Workspace-layer keys this directory declares, e.g. ["peer.id"]. */
  overrides: string[];
  risks: string[];
}

/** Attach the cross-workspace answer to each resolved project. Two distinct
 * directories under one peer share memories; an empty peer means they share
 * the user-level space with every other empty one. */
export function summarizeWorkspaces(projects: MemoryProject[]): WorkspaceSummary[] {
  return projects.map((project) => {
    const sharedWith = project.peer === ""
      ? projects.filter((other) => other !== project && other.peer === "").map((other) => other.cwd)
      : projects.filter((other) => other !== project && other.peer === project.peer).map((other) => other.cwd);
    return {
      path: project.cwd,
      workspaceRoot: project.workspaceRoot,
      peer: project.peer,
      peerOrigin: project.peerOrigin,
      sharedWith,
      userLevelSpace: project.peer === "",
      overrides: project.declarations.map((item) => item.key),
      risks: project.risks.map((risk) => risk.code),
    };
  });
}

/** Resolve with the operation's own result, or with a `restart-timeout`
 * outcome once `budget` elapses. The abandoned restart is not cancelled — it
 * may still finish — so the caller must treat a timeout as "unknown state",
 * not as "nothing happened". */
async function withTimeout(operation: Promise<RestartResult>, budget: number): Promise<RestartResult> {
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<RestartResult>((resolve) => {
    timer = setTimeout(() => resolve({ restarted: false, count: 0, reason: "restart-timeout" }), budget);
    timer.unref?.();
  });
  try {
    return await Promise.race([operation, expiry]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function rejectCrossOrigin(req: IncomingMessage, res: ServerResponse, allowedHosts: ReadonlySet<string>): boolean {
  if (isRequestAllowed(req, allowedHosts)) return false;
  writeJson(res, 403, { error: "same-origin requests only" });
  return true;
}

export function makeManagerRoutes(options: ManagerApiOptions = {}): WebRoute[] {
  const env = options.env ?? process.env;
  const allowedHosts = normalizedAllowedHosts([
    ...(options.allowedHosts ?? []),
    ...(env.DSH_OPENVIKING_MANAGER_ALLOWED_HOSTS ?? "").split(","),
  ]);
  const { ovcliPath, ovconfPath } = resolvePaths(options, env);
  const preferencesPath = options.preferencesPath ?? resolveUiPreferencesPath(env);
  const scopeOptionsFor = (project: MemoryProject): { workspaceScope?: unknown; workspaceLayer?: string } => {
    const declaration = project.declarations.find((item) => item.key === "recall.peer_scope");
    return { workspaceScope: declaration?.value, workspaceLayer: declaration?.layer };
  };
  const workspaceValuesFor = (project: MemoryProject): WorkspaceKnobValues => {
    const values: WorkspaceKnobValues = {};
    for (const declaration of project.declarations) values[declaration.key] = { value: declaration.value, layer: declaration.layer };
    return values;
  };
  const peerSourceWorkspaceFor = (project: MemoryProject): { value: unknown; layer: string } | undefined => {
    const declaration = project.declarations.find((item) => item.key === "peer.source");
    return declaration === undefined ? undefined : { value: declaration.value, layer: declaration.layer };
  };
  const peerIdWorkspaceFor = (project: MemoryProject): { value: unknown; layer: string } | undefined => {
    const declaration = project.declarations.find((item) => item.key === "peer.id");
    return declaration === undefined ? undefined : { value: declaration.value, layer: declaration.layer };
  };

  /** Resolve the project `cwd` belongs to. Everything the official loader reads
   * is passed in explicitly — ovcli.conf, ov.conf's legacy `dsh` section, the
   * env — so a test with injected paths never resolves the real user files. */
  const readProject = async (cwd: string): Promise<MemoryProject> => {
    const [ovcli, ovconfDsh, userKey] = await Promise.all([
      readOvcliObject(ovcliPath),
      readOvconfDshSection(ovconfPath),
      loadOvcliUserKey(ovcliPath),
    ]);
    const pinned = effectivePeerId(ovcli, env);
    return readMemoryProject({
      cwd,
      env,
      ovcli,
      ovconfDsh,
      rootKeyCredential: await credentialIsLocalRootKey(ovconfPath, userKey),
      pinnedPeer: { peerId: pinned.peerId, source: pinned.source },
    });
  };

  const cwdOf = (req: IncomingMessage): string => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const raw = url.searchParams.get("cwd");
    const candidate = raw === null || raw.trim() === "" ? HOST_CWD : raw.trim();
    if (!isAbsolute(candidate) || candidate.length > MAX_CWD_CHARS) throw new Error("cwd must be an absolute path");
    return resolvePath(candidate);
  };

  // The official plugin resolves its config once at apply, and constructing
  // these routes happens at apply too, so this snapshot is what it loaded. It
  // advances only after a successful plugin restart. The workspace layers for
  // the host directory are not part of it (they need the async official
  // loader); a repository file that outranks the file therefore reads as
  // pending once and settles after the reload it prompts.
  let loadedScope = snapshotLoadedRecallScope(ovcliPath, env);
  let loadedTuning = snapshotLoadedRecallTuning(ovcliPath, env);
  let loadedPeerId = snapshotLoadedPeerId(ovcliPath, env);
  let restarting = false;
  const scopeView = async (cwd: string) =>
    recallScopeView(ovcliPath, { env, loadedScope, project: await readProject(cwd) });
  const tuningView = async (cwd: string) => {
    const project = await readProject(cwd);
    return recallTuningView(ovcliPath, { env, loaded: loadedTuning, workspace: workspaceValuesFor(project) });
  };
  const peerView = async (cwd: string) => {
    const project = await readProject(cwd);
    return peerIdView(ovcliPath, { env, loadedPeerId, project, workspace: peerIdWorkspaceFor(project) });
  };
  return [
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/discovery`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method !== "GET") {
          writeJson(res, 405, { error: "method not allowed" });
          return;
        }
        try {
          writeJson(res, 200, { ok: true, value: await discoverLocalOpenViking({ ovcliPath, ovconfPath }) });
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to discover local OpenViking configuration" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/config`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method === "GET") {
          try {
            writeJson(res, 200, { ok: true, value: await loadOvcliConfig(ovcliPath) });
          } catch (error) {
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
          const before = await loadOvcliConfig(ovcliPath);
          const config = await saveOvcliConfig(ovcliPath, { url, account, user, ...(apiKey === undefined ? {} : { apiKey }) });
          // A blank key preserves the stored one only while the endpoint
          // origin stays the same. Tell the UI when the save retired it, so the
          // empty masked field is explained instead of looking like data loss.
          const keyCleared = before.kind === "ready" && before.config.apiKeySet && !config.apiKeySet;
          writeJson(res, 200, { ok: true, value: { kind: "ready", config, permissionWarning: false, keyCleared } });
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save ovcli.conf" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/probe`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
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
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to verify OpenViking connection" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/admin`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method !== "POST") {
          writeJson(res, 405, { error: "method not allowed" });
          return;
        }
        try {
          const body = await readJson(req);
          const operation = requiredString(body, "operation");
          const rootApiKey = requiredString(body, "rootApiKey");
          // Reject an unknown operation before its fields: otherwise a typo
          // reports "accountId is required" instead of the real problem.
          if (!["accounts", "users", "create-account", "create-user", "rotate-user-key"].includes(operation)) {
            writeJson(res, 400, { ok: false, error: "unsupported admin operation" });
            return;
          }
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
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "OpenViking admin request failed" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/session-toggle`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
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
          if (typeof (body as Record<string, unknown>).enabled !== "boolean") {
            writeJson(res, 400, { ok: false, error: "enabled must be a boolean" });
            return;
          }
          setOpenVikingEnabled(sessionId, (body as { enabled: boolean }).enabled);
          writeJson(res, 200, { ok: true, value: { sessionId, enabled: isSessionOpenVikingEnabled(sessionId) } });
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to update the session toggle" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/ui-preferences`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method === "GET") {
          writeJson(res, 200, { ok: true, value: await loadUiPreferences(preferencesPath) });
          return;
        }
        if (req.method !== "PUT") {
          writeJson(res, 405, { error: "method not allowed" });
          return;
        }
        let patch;
        try {
          patch = parseUiPreferencesPatch(await readJson(req));
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Invalid preferences" });
          return;
        }
        try {
          const saved = await saveUiPreferences(preferencesPath, patch);
          try {
            options.onPreferencesSaved?.(saved);
          } catch {
            // The file is already saved; a host bookkeeping failure must not
            // turn a successful save into a 500. The next save or restart
            // re-applies the value.
          }
          writeJson(res, 200, { ok: true, value: saved });
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to save preferences" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/repair-permissions`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method !== "POST") {
          writeJson(res, 405, { error: "method not allowed" });
          return;
        }
        try {
          await repairOvcliPermissions(ovcliPath);
          writeJson(res, 200, { ok: true, value: await loadOvcliConfig(ovcliPath) });
        } catch (error) {
          writeJson(res, 403, { ok: false, error: error instanceof Error ? error.message : "Unable to repair file permissions" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/version`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
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
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to read version information" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/recall-scope`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method === "GET") {
          try {
            writeJson(res, 200, { ok: true, value: await scopeView(cwdOf(req)) });
          } catch (error) {
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
          writeJson(res, 200, { ok: true, value: await scopeView(cwdOf(req)) });
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save the memory isolation setting" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/recall-tuning`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method === "GET") {
          try {
            writeJson(res, 200, { ok: true, value: await tuningView(cwdOf(req)) });
          } catch (error) {
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
          writeJson(res, 200, { ok: true, value: await tuningView(cwdOf(req)) });
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save the recall tuning settings" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/recall-peer`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method === "GET") {
          try {
            writeJson(res, 200, { ok: true, value: await peerView(cwdOf(req)) });
          } catch (error) {
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
          writeJson(res, 200, { ok: true, value: await peerView(cwdOf(req)) });
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save the actor peer id" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/recall-peer/derive`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method !== "GET") {
          writeJson(res, 405, { error: "method not allowed" });
          return;
        }
        try {
          const project = await readProject(cwdOf(req));
          writeJson(res, 200, {
            ok: true,
            value: { peerId: project.peer, origin: project.peerOrigin, project },
          });
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to derive the peer id" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/peer-source`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method === "GET") {
          try {
            const project = await readProject(cwdOf(req));
            writeJson(res, 200, { ok: true, value: await peerSourceView(ovcliPath, { env, workspace: peerSourceWorkspaceFor(project) }) });
          } catch (error) {
            writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to read the peer source rule" });
          }
          return;
        }
        if (req.method !== "PUT") {
          writeJson(res, 405, { error: "method not allowed" });
          return;
        }
        try {
          // The value domain is the official `peer.source`: a preset name, a
          // template, or a list of templates tried in order.
          const body = await readJson(req);
          const value = normalizePeerSource((body as Record<string, unknown> | null)?.peerSource);
          await savePeerSource(ovcliPath, value);
          const project = await readProject(cwdOf(req));
          writeJson(res, 200, { ok: true, value: await peerSourceView(ovcliPath, { env, workspace: peerSourceWorkspaceFor(project) }) });
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save the peer source rule" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/workspaces`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method !== "GET") {
          writeJson(res, 405, { error: "method not allowed" });
          return;
        }
        try {
          const paths = options.workspacePaths?.();
          const all = paths ?? [];
          const projects = await Promise.all(all.slice(0, MAX_WORKSPACES).map((path) => readProject(path)));
          writeJson(res, 200, {
            ok: true,
            value: {
              available: paths !== undefined,
              truncated: all.length > MAX_WORKSPACES,
              workspaces: summarizeWorkspaces(projects),
            },
          });
        } catch (error) {
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to list the workspaces" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/recall-scope/restart`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res, allowedHosts)) return;
        if (req.method !== "POST") {
          writeJson(res, 405, { error: "method not allowed" });
          return;
        }
        if (restarting) {
          writeJson(res, 409, { ok: false, code: "restart-in-progress", error: "A plugin restart is already running" });
          return;
        }
        if (!options.restartMemoryPlugin) {
          writeJson(res, 200, { ok: true, value: { restarted: false, count: 0, reason: "plugin-unavailable" } satisfies RestartResult });
          return;
        }
        restarting = true;
        const budget = options.restartTimeoutMs ?? RESTART_TIMEOUT_MS;
        const operation = options.restartMemoryPlugin();
        let result: RestartResult;
        try {
          result = await withTimeout(operation, budget);
        } catch (error) {
          restarting = false;
          writeJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unable to restart the official memory plugin" });
          return;
        }
        if (result.reason === "restart-timeout") {
          // The abandoned restart may still be running. Keep the guard until
          // it settles: clearing it here would let a second request start a
          // concurrent fiber restart while the first is still committing.
          operation.then(() => { restarting = false; }, () => { restarting = false; });
          writeJson(res, 200, { ok: true, value: result });
          return;
        }
        try {
          // A successful restart re-applied the plugin, so whatever the file
          // says now is the value it loaded — for the isolation scope and the
          // recall tuning knobs alike: one reload picks up every key.
          if (result.restarted) {
            // The plugin re-applied with the host directory, so the baseline
            // becomes what that directory resolves to now — workspace layers
            // included.
            const hostProject = await readProject(HOST_CWD);
            loadedScope = snapshotLoadedRecallScope(ovcliPath, env, scopeOptionsFor(hostProject));
            loadedTuning = snapshotLoadedRecallTuning(ovcliPath, env, workspaceValuesFor(hostProject));
            loadedPeerId = snapshotLoadedPeerId(ovcliPath, env);
          }
          writeJson(res, 200, { ok: true, value: result });
        } finally {
          restarting = false;
        }
      },
    },
  ];
}
