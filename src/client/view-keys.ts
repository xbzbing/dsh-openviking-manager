import type { TranslationKey } from "./i18n.js";

/** One display key per server-side layer name. */
export const SOURCE_KEYS: Record<string, TranslationKey> = {
  env: "scopeSourceEnv",
  workspace: "scopeSourceWorkspace",
  "plugin.dsh": "scopeSourceDsh",
  plugin: "scopeSourceShared",
  default: "scopeSourceDefault",
};
