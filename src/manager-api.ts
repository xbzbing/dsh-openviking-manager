import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
import { homedir } from "node:os";
import { join } from "node:path";
import { discoverLocalOpenViking } from "./local-discovery.js";
import { loadOvcliConfig, loadOvcliUserKey, repairOvcliPermissions, saveOvcliConfig } from "./ovcli-config.js";
import { probeOpenViking } from "./openviking-client.js";
import { createAccount, createUser, listAccounts, listUsers, rotateUserKey } from "./openviking-admin.js";

export const MANAGER_API_PREFIX = "/plugins/dsh-openviking-manager/api";
const MAX_BODY_BYTES = 32 * 1024;

export interface ManagerApiOptions {
  ovcliPath?: string;
  ovconfPath?: string;
}

function configPathOf(options: ManagerApiOptions): string {
  return options.ovcliPath ?? join(homedir(), ".openviking", "ovcli.conf");
}

function ovconfPathOf(options: ManagerApiOptions): string {
  return options.ovconfPath ?? join(homedir(), ".openviking", "ov.conf");
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

function isSameOrigin(req: IncomingMessage): boolean {
  const host = req.headers.host;
  const origin = req.headers.origin;
  if (typeof host !== "string" || origin === undefined) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function rejectCrossOrigin(req: IncomingMessage, res: ServerResponse): boolean {
  if (isSameOrigin(req)) return false;
  writeJson(res, 403, { error: "same-origin requests only" });
  return true;
}

export function makeManagerRoutes(options: ManagerApiOptions = {}): WebRoute[] {
  const ovcliPath = configPathOf(options);
  const ovconfPath = ovconfPathOf(options);
  return [
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/discovery`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res)) return;
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
        if (rejectCrossOrigin(req, res)) return;
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
          const config = await saveOvcliConfig(ovcliPath, { url, account, user, ...(apiKey === undefined ? {} : { apiKey }) });
          writeJson(res, 200, { ok: true, value: { kind: "ready", config, permissionWarning: false } });
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "Unable to save ovcli.conf" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/probe`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res)) return;
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
        if (rejectCrossOrigin(req, res)) return;
        if (req.method !== "POST") {
          writeJson(res, 405, { error: "method not allowed" });
          return;
        }
        try {
          const body = await readJson(req);
          const operation = requiredString(body, "operation");
          const rootApiKey = requiredString(body, "rootApiKey");
          const current = await loadOvcliConfig(ovcliPath);
          const url = current.kind === "ready" ? current.config.url : requiredString(body, "url");
          if (operation === "accounts") {
            writeJson(res, 200, { ok: true, value: { operation, accounts: await listAccounts(url, rootApiKey) } });
            return;
          }
          const accountId = requiredString(body, "accountId");
          if (operation === "users") {
            writeJson(res, 200, { ok: true, value: { operation, users: await listUsers(url, rootApiKey, accountId) } });
            return;
          }
          const userId = requiredString(body, "userId");
          if (operation === "create-account") {
            const created = await createAccount(url, rootApiKey, accountId, userId);
            writeJson(res, 200, { ok: true, value: { operation, created } });
            return;
          }
          if (operation === "create-user") {
            const created = await createUser(url, rootApiKey, accountId, userId);
            writeJson(res, 200, { ok: true, value: { operation, created } });
            return;
          }
          if (operation === "rotate-user-key") {
            const userKey = await rotateUserKey(url, rootApiKey, accountId, userId);
            writeJson(res, 200, { ok: true, value: { operation, userKey } });
            return;
          }
          writeJson(res, 400, { ok: false, error: "unsupported admin operation" });
        } catch (error) {
          writeJson(res, 400, { ok: false, error: error instanceof Error ? error.message : "OpenViking admin request failed" });
        }
      },
    },
    {
      kind: "exact",
      path: `${MANAGER_API_PREFIX}/repair-permissions`,
      handler: async (req, res) => {
        if (rejectCrossOrigin(req, res)) return;
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
  ];
}
