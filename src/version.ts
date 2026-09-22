import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

interface PackageManifest {
  version?: unknown;
  repository?: unknown;
}

/** Resolve package.json relative to the compiled module (lib/version.js -> ../package.json). */
function manifestPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Extract the "git+https://…/owner/repo.git", "github:owner/repo", or "owner/repo" form into { owner, repo }. */
function parseRepository(repository: unknown): { owner: string; repo: string } | undefined {
  const raw =
    typeof repository === "string"
      ? repository
      : typeof repository === "object" && repository !== null
        ? stringField((repository as { url?: unknown }).url)
        : undefined;
  if (raw === undefined) return undefined;
  const fromHost = raw.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:$|[/#?])/i);
  if (fromHost !== null) return { owner: fromHost[1]!, repo: fromHost[2]! };
  // npm shorthand forms: "github:owner/repo" or bare "owner/repo".
  const shorthand = raw.match(/^(?:github:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
  if (shorthand !== null) return { owner: shorthand[1]!, repo: shorthand[2]! };
  return undefined;
}

/**
 * Compare dotted numeric versions with basic prerelease handling; returns 1
 * when a > b, -1 when a < b, 0 when equal. A release outranks a prerelease
 * that shares the same core (e.g. 0.2.0 > 0.2.0-beta.1).
 */
export function compareVersions(a: string, b: string): number {
  const split = (value: string): { core: number[]; prerelease: boolean } => {
    const trimmed = value.trim().replace(/^v/i, "");
    const [core, ...rest] = trimmed.split("-");
    return {
      core: core!
        .split(".")
        .map((part) => Number.parseInt(part, 10))
        .filter((part) => Number.isFinite(part)),
      prerelease: rest.length > 0 && rest.join("-") !== "",
    };
  };
  const left = split(a);
  const right = split(b);
  const length = Math.max(left.core.length, right.core.length);
  for (let index = 0; index < length; index += 1) {
    const l = left.core[index] ?? 0;
    const r = right.core[index] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  if (left.prerelease === right.prerelease) return 0;
  return left.prerelease ? -1 : 1;
}

async function readManifest(path: string): Promise<PackageManifest> {
  const raw = await readFile(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) throw new Error("package.json is not an object");
  return parsed as PackageManifest;
}

/** Local-only view: current version and repository URL, no network access. */
export async function readVersionInfo(options: { manifestPath?: string } = {}): Promise<VersionCheckResult> {
  const manifest = await readManifest(options.manifestPath ?? manifestPath());
  const current = stringField(manifest.version) ?? "0.0.0";
  const repo = parseRepository(manifest.repository);
  const repositoryUrl = repo === undefined ? undefined : `https://github.com/${repo.owner}/${repo.repo}`;
  return {
    current,
    repositoryUrl,
    latest: undefined,
    updateAvailable: false,
    releaseUrl: undefined,
    checkedRemote: false,
  };
}

/**
 * Query the GitHub releases API for the latest tag and compare it to the
 * bundled version. Network or parse failures are reported through `error`
 * instead of throwing, so the caller can still show the current version.
 */
export async function checkLatestVersion(
  options: { manifestPath?: string; fetchFn?: VersionFetch } = {},
): Promise<VersionCheckResult> {
  const base = await readVersionInfo({ manifestPath: options.manifestPath });
  const repo = parseRepository((await readManifest(options.manifestPath ?? manifestPath())).repository);
  if (repo === undefined) {
    return { ...base, checkedRemote: false, error: "repository is not configured" };
  }
  const fetchFn = options.fetchFn ?? fetch;
  try {
    const response = await fetchFn(`https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "dsh-openviking-manager" },
    });
    if (!response.ok) {
      return { ...base, checkedRemote: true, error: `GitHub responded with ${response.status}` };
    }
    const body: unknown = await response.json();
    const tag = typeof body === "object" && body !== null ? stringField((body as { tag_name?: unknown }).tag_name) : undefined;
    const htmlUrl = typeof body === "object" && body !== null ? stringField((body as { html_url?: unknown }).html_url) : undefined;
    if (tag === undefined) {
      return { ...base, checkedRemote: true, error: "GitHub response did not include a release tag" };
    }
    const latest = tag.replace(/^v/i, "");
    return {
      ...base,
      checkedRemote: true,
      latest,
      updateAvailable: compareVersions(latest, base.current) > 0,
      releaseUrl: htmlUrl ?? `${base.repositoryUrl ?? ""}/releases/latest`,
    };
  } catch (error) {
    return { ...base, checkedRemote: true, error: error instanceof Error ? error.message : "Unable to reach GitHub" };
  }
}
