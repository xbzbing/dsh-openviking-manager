import test from "node:test";
import assert from "node:assert/strict";
import { OPENVIKING_MCP_PREFIX, openVikingToolDenialReason } from "../../lib/ov-tool-guard.js";

test("denies OpenViking MCP tools only while its step policy is disabled", () => {
  const name = `${OPENVIKING_MCP_PREFIX}memory_save`;
  assert.equal(openVikingToolDenialReason(name, true), undefined);
  const reason = openVikingToolDenialReason(name, false);
  assert.equal(typeof reason, "string");
  assert.match(reason, /disabled/i);
});

test("never denies non-OpenViking tools", () => {
  assert.equal(openVikingToolDenialReason("write_file", false), undefined);
  assert.equal(openVikingToolDenialReason("mcp__other__memory_save", false), undefined);
  assert.equal(openVikingToolDenialReason(undefined, false), undefined);
});
