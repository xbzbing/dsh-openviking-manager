import type { IncomingMessage, ServerResponse } from "node:http";
import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadOvcliConfig, repairOvcliPermissions, saveOvcliConfig } from "./ovcli-config.js";

export const MANAGER_API_PREFIX = "/plugins/dsh-openviking-manager/api";
const MAX_BODY_BYTES = 32 * 1024;

export interface ManagerApiOptions {
  ovcliPath?: string;
}

function configPathOf(options: ManagerApiOptions): string {
  return options.ovcliPath ?? join(homedir(), ".openviking", "ovcli.conf");
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
  return [
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
