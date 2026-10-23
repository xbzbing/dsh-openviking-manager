import { readFile } from "node:fs/promises";
import { loadOvcliConfig, type OvcliLoadResult } from "./ovcli-config.js";

export interface LocalServerView {
  found: boolean;
  authMode: string | undefined;
  rootKeyAvailable: boolean;
  configError: string | undefined;
}

export interface LocalOpenVikingDiscovery {
  ovcli: OvcliLoadResult;
  suggestedEndpoint: string;
  localServer: LocalServerView;
}

export interface LocalDiscoveryOptions {
  ovcliPath: string;
  ovconfPath: string;
}

function configRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function localServerOf(value: unknown): LocalServerView & { port: number } {
  const top = configRecord(value);
  const server = configRecord(top?.server);
  const rawPort = server?.port;
  const port = typeof rawPort === "number" && Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 1933;
  return {
    found: true,
    authMode: typeof server?.auth_mode === "string" ? server.auth_mode : undefined,
    rootKeyAvailable: typeof server?.root_api_key === "string" && server.root_api_key !== "",
    configError: undefined,
    port,
  };
}

async function readLocalServer(path: string): Promise<LocalServerView & { port: number }> {
  try {
    const raw = await readFile(path, "utf8");
    try {
      return localServerOf(JSON.parse(raw));
    } catch {
      return { found: true, authMode: undefined, rootKeyAvailable: false, configError: "ov.conf is not valid JSON", port: 1933 };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { found: false, authMode: undefined, rootKeyAvailable: false, configError: undefined, port: 1933 };
    }
    return { found: false, authMode: undefined, rootKeyAvailable: false, configError: "ov.conf could not be read", port: 1933 };
  }
}

/**
 * Discover local configuration without returning any secret from ov.conf. An
 * existing ovcli.conf always wins over a server-side inferred endpoint.
 */
export async function discoverLocalOpenViking(options: LocalDiscoveryOptions): Promise<LocalOpenVikingDiscovery> {
  const [ovcli, server] = await Promise.all([loadOvcliConfig(options.ovcliPath), readLocalServer(options.ovconfPath)]);
  const suggestedEndpoint = ovcli.kind === "ready" ? ovcli.config.url : `http://127.0.0.1:${server.port}`;
  const { port: _port, ...localServer } = server;
  return { ovcli, suggestedEndpoint, localServer };
}

/** The `dsh` section of ov.conf — the official loader's legacy layer, which
 * sits below every ovcli.conf key. Only knob values are read from it. */
export async function readOvconfDshSection(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const top = configRecord(JSON.parse(await readFile(path, "utf8")));
    return configRecord(top?.dsh);
  } catch {
    return undefined;
  }
}

/** True when the key saved for the OpenViking client is the local server's own
 * root key. From server v0.5.2 on, `/mcp` refuses root keys, so such a setup
 * authenticates on the data plane and fails every bridged memory tool. The key
 * itself never leaves this function — only the boolean answer does. */
export async function credentialIsLocalRootKey(ovconfPath: string, apiKey: string): Promise<boolean> {
  if (apiKey === "") return false;
  try {
    const server = configRecord(configRecord(JSON.parse(await readFile(ovconfPath, "utf8")))?.server);
    const root = server?.root_api_key;
    return typeof root === "string" && root !== "" && root === apiKey;
  } catch {
    return false;
  }
}
