import { type OvcliLoadResult } from "./ovcli-config.js";
export interface LocalServerView {
    found: boolean;
    authMode: string | undefined;
    rootKeyAvailable: boolean;
    configError: string | undefined;
}
export interface LocalOpenVikingDiscovery {
    ovcli: OvcliLoadResult;
    suggestedEndpoint: string;
    localServer: LocalServerView;
}
export interface LocalDiscoveryOptions {
    ovcliPath: string;
    ovconfPath: string;
}
/**
 * Discover local configuration without returning any secret from ov.conf. An
 * existing ovcli.conf always wins over a server-side inferred endpoint.
 */
export declare function discoverLocalOpenViking(options: LocalDiscoveryOptions): Promise<LocalOpenVikingDiscovery>;
