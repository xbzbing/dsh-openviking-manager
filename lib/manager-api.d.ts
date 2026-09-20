import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
export declare const MANAGER_API_PREFIX = "/plugins/dsh-openviking-manager/api";
export interface ManagerApiOptions {
    ovcliPath?: string;
    ovconfPath?: string;
}
export declare function makeManagerRoutes(options?: ManagerApiOptions): WebRoute[];
