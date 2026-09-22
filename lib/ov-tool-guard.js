/** Model-facing prefix of the bridged OpenViking MCP tools. Mirrors
 * `MCP_SERVER_NAME = "openviking"` in the official memory plugin. */
export const OPENVIKING_MCP_PREFIX = "mcp__openviking__";
export function openVikingToolDenialReason(name, enabled) {
    if (typeof name !== "string" || !name.startsWith(OPENVIKING_MCP_PREFIX))
        return undefined;
    if (enabled)
        return undefined;
    return "OpenViking is disabled for this session, so its memory tools are unavailable. Ask the user to re-enable the OpenViking toggle in the input bar if memory access is needed.";
}
