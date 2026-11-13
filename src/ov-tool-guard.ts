/** Model-facing prefix of the bridged OpenViking MCP tools. Mirrors
 * `MCP_SERVER_NAME = "openviking"` in the official memory plugin. */
export const OPENVIKING_MCP_PREFIX = "mcp__openviking__";

export function openVikingToolDenialReason(
  name: unknown,
  enabled: boolean,
  rememberBlocked = false,
): string | undefined {
  if (typeof name !== "string" || !name.startsWith(OPENVIKING_MCP_PREFIX)) return undefined;
  if (!enabled) {
    return "OpenViking is disabled for this session, so its memory tools are unavailable. Ask the user to re-enable the OpenViking toggle in the input bar if memory access is needed.";
  }
  // `remember` has no peer argument: an explicit call lands in the user-level
  // space instead of this project's peer. The manager setting blocks that one
  // tool while leaving automatic capture (which does carry the peer) alone.
  if (rememberBlocked && name === `${OPENVIKING_MCP_PREFIX}remember`) {
    return "Explicit OpenViking memory writes are disabled by the OpenViking manager. State the fact in the conversation instead; automatic capture records it with this project's peer.";
  }
  return undefined;
}
