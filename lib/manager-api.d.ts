import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
export declare const MANAGER_API_PREFIX = "/plugins/dsh-openviking-manager/api";
/** Sent when an admin operation is attempted before an OpenViking endpoint is saved. */
export declare const ENDPOINT_NOT_CONFIGURED_CODE = "endpoint-not-configured";
export interface ManagerApiOptions {
    ovcliPath?: string;
    ovconfPath?: string;
}
export declare function makeManagerRoutes(options?: ManagerApiOptions): WebRoute[];
