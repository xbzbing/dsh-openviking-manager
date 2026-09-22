export type VersionFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
export interface VersionCheckResult {
    /** Version declared in this plugin's package.json. */
    current: string;
    /** Browsable GitHub repository URL, or undefined when it cannot be derived. */
    repositoryUrl: string | undefined;
    /** Latest release tag reported by GitHub, without the leading "v". */
    latest: string | undefined;
    /** True only when a strictly newer release than {@link current} exists. */
    updateAvailable: boolean;
    /** Browsable URL of the latest release, or undefined when unknown. */
    releaseUrl: string | undefined;
    /** True when the remote registry was queried (false for the local-only view). */
    checkedRemote: boolean;
    /** Present when the remote check could not complete. */
    error?: string;
}
/**
 * Compare dotted numeric versions with basic prerelease handling; returns 1
 * when a > b, -1 when a < b, 0 when equal. A release outranks a prerelease
 * that shares the same core (e.g. 0.2.0 > 0.2.0-beta.1).
 */
export declare function compareVersions(a: string, b: string): number;
/** Local-only view: current version and repository URL, no network access. */
export declare function readVersionInfo(options?: {
    manifestPath?: string;
}): Promise<VersionCheckResult>;
/**
 * Query the GitHub releases API for the latest tag and compare it to the
 * bundled version. Network or parse failures are reported through `error`
 * instead of throwing, so the caller can still show the current version.
 */
export declare function checkLatestVersion(options?: {
    manifestPath?: string;
    fetchFn?: VersionFetch;
}): Promise<VersionCheckResult>;
