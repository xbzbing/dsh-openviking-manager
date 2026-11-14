import type { TranslationKey } from "./i18n.js";

/** One display key per server-side layer name. */
export const SOURCE_KEYS: Record<string, TranslationKey> = {
  env: "scopeSourceEnv",
  workspace: "scopeSourceWorkspace",
  "plugin.dsh": "scopeSourceDsh",
  plugin: "scopeSourceShared",
  default: "scopeSourceDefault",
};

/** One display key per server-side isolation risk code, shared by every view
 * that reports risks (the workspace list is now the only one). */
export const RISK_KEYS: Record<string, TranslationKey> = {
  "workspace-scope-all": "riskScopeAll",
  "workspace-disables-recall": "riskRecallOff",
  "workspace-disables-capture": "riskCaptureOff",
  "pinned-peer": "riskPinnedPeer",
  "workspace-pins-peer": "riskWorkspacePeer",
  "peer-id-conflict": "riskPeerConflict",
  "no-peer": "riskNoPeer",
  "root-key-credential": "riskRootKey",
};
