export interface OvcliConfigView {
    url: string;
    account: string;
    user: string;
    apiKeySet: boolean;
    apiKeyMasked: string;
}
export type OvcliLoadResult = {
    kind: "missing";
    config: OvcliConfigView;
} | {
    kind: "invalid-json";
    message: string;
    config: OvcliConfigView;
} | {
    kind: "invalid-shape";
    message: string;
    config: OvcliConfigView;
} | {
    kind: "ready";
    config: OvcliConfigView;
    permissionWarning: boolean;
};
export interface OvcliConfigInput {
    url: string;
    account: string;
    user: string;
    /** Undefined preserves a previously stored user key. */
    apiKey?: string;
}
export declare function assertHttpEndpoint(raw: string): string;
export declare function loadOvcliUserKey(path: string): Promise<string>;
export declare function loadOvcliConfig(path: string): Promise<OvcliLoadResult>;
export declare function saveOvcliConfig(path: string, input: OvcliConfigInput): Promise<OvcliConfigView>;
export declare function repairOvcliPermissions(path: string): Promise<void>;
