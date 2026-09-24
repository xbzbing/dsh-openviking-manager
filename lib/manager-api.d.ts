import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
import { type RecallScopeEnv } from "./recall-scope.js";
import type { RestartResult } from "./openviking-restart.js";
export declare const MANAGER_API_PREFIX = "/plugins/dsh-openviking-manager/api";
/** Sent when an admin operation is attempted before an OpenViking endpoint is saved. */
export declare const ENDPOINT_NOT_CONFIGURED_CODE = "endpoint-not-configured";
export interface ManagerApiOptions {
    ovcliPath?: string;
    ovconfPath?: string;
    /** Host-injected reload of the official memory plugin. Absent means the
     * official plugin cannot be restarted in this process (optional peer); the
     * restart route then reports `plugin-unavailable` instead of failing. */
    restartMemoryPlugin?: () => Promise<RestartResult>;
    /** Env layer for the recall-scope view; defaults to process.env. Tests pass
     * an explicit object so a machine-level OPENVIKING_* variable cannot leak
     * into assertions. */
    env?: RecallScopeEnv;
}
export declare function makeManagerRoutes(options?: ManagerApiOptions): WebRoute[];
