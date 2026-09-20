export interface OpenVikingConnection {
    url: string;
    apiKey: string;
    account: string;
    user: string;
}
export interface OpenVikingProbeResult {
    reachable: boolean;
    ready: boolean;
    authenticated: boolean;
    identity: {
        account: string;
        user: string;
    } | undefined;
}
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
/** Probe only normal data-plane endpoints with a user key; never accept root keys. */
export declare function probeOpenViking(connection: OpenVikingConnection, fetchFn?: FetchLike): Promise<OpenVikingProbeResult>;
