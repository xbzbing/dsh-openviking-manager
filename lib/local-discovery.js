import { readFile } from "node:fs/promises";
import { loadOvcliConfig } from "./ovcli-config.js";
function configRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
function localServerOf(value) {
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
async function readLocalServer(path) {
    try {
        const raw = await readFile(path, "utf8");
        try {
            return localServerOf(JSON.parse(raw));
        }
        catch {
            return { found: true, authMode: undefined, rootKeyAvailable: false, configError: "ov.conf is not valid JSON", port: 1933 };
        }
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return { found: false, authMode: undefined, rootKeyAvailable: false, configError: undefined, port: 1933 };
        }
        return { found: false, authMode: undefined, rootKeyAvailable: false, configError: "ov.conf could not be read", port: 1933 };
    }
}
/**
 * Discover local configuration without returning any secret from ov.conf. An
 * existing ovcli.conf always wins over a server-side inferred endpoint.
 */
export async function discoverLocalOpenViking(options) {
    const [ovcli, server] = await Promise.all([loadOvcliConfig(options.ovcliPath), readLocalServer(options.ovconfPath)]);
    const suggestedEndpoint = ovcli.kind === "ready" ? ovcli.config.url : `http://127.0.0.1:${server.port}`;
    const { port: _port, ...localServer } = server;
    return { ovcli, suggestedEndpoint, localServer };
}
