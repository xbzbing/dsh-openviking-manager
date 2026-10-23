/** Project-level memory isolation for the official OpenViking memory plugin.
 *
 * The official plugin resolves one "peer" per session from that session's
 * workspace: the git remote, or the repository root when there is no remote.
 * One project therefore keeps one memory namespace across clones, worktrees,
 * subdirectories, agents and machines, while a session outside a repository
 * sends no peer at all and lands in the user-level space. Combined with
 * `recallPeerScope: actor` — recall only the current peer — that is exactly the
 * isolation model this manager exposes: a conversation recalls its own
 * project's memories and nothing from another project on the same machine.
 *
 * The official loader ranks three workspace layers above ovcli.conf:
 *
 *   1  OPENVIKING_* environment               (highest)
 *   2  <home>/workspaces/<slot>.json          per machine, per workspace
 *   3  <root>/.openviking/config.local.json   this checkout, private
 *   4  <root>/.openviking/config.json         committed to the repository
 *   5  ovcli.conf plugin.dsh
 *   6  ovcli.conf plugin
 *   7  ov.conf dsh                            legacy
 *   8  config-schema.mjs defaults             (lowest)
 *
 * A repository-committed file therefore outranks anything this manager writes
 * to ovcli.conf, and can switch isolation off for everyone who clones it. This
 * module never reimplements that merge: it asks the official `resolveSettings`
 * and `resolveWorkspaceSettings` for the effective value, the provenance of
 * every workspace key and the warnings they emit, so the panel can name the
 * layer in charge instead of guessing. Nothing here writes a file.
 *
 * The official package is an optional peer, so every step degrades to an
 * "unavailable" answer rather than throwing. */

import { readFileSync } from "node:fs";

export type ProjectRiskCode =
  | "no-peer"
  | "workspace-scope-all"
  | "workspace-disables-recall"
  | "workspace-disables-capture"
  | "workspace-pins-peer"
  | "pinned-peer"
  | "root-key-credential"
  | "peer-id-conflict";

export type RiskSeverity = "error" | "warning";

export interface ProjectRisk {
  code: ProjectRiskCode;
  severity: RiskSeverity;
  /** Values the UI interpolates into its copy (peer id, layer, path, …). */
  values?: Record<string, string>;
}

/** One key a workspace layer declares, with the layer that won. */
export interface WorkspaceDeclaration {
  key: string;
  value: unknown;
  layer: string;
}

export interface MemoryProject {
  /** True when the official package was resolvable and the merge ran. */
  available: boolean;
  /** The project directory the answer describes. */
  cwd: string;
  /** Repository root of `cwd`, or "" when it is not inside a repository. */
  workspaceRoot: string;
  /** Peer the official plugin would use for a session in `cwd`; "" means the
   * session writes to the user-level space (no project namespace). */
  peer: string;
  /** How that peer was obtained: an explicit pin, or the official template
   * label such as `{git_remote}`; "" when no peer was derived. */
  peerOrigin: string;
  /** An explicit pin this manager can see in env / ovcli.conf (not a
   * repository declaration). "" when the peer stays automatic. */
  pinnedPeer: string;
  /** Which layer supplied `pinnedPeer`. */
  pinnedPeerSource: string;
  /** Workspace-layer declarations that outrank ovcli.conf. */
  declarations: WorkspaceDeclaration[];
  /** Official loader warnings (unreadable file, clamped value, …). */
  warnings: string[];
  /** Problems with the isolation model itself, most severe first. */
  risks: ProjectRisk[];
}

export interface MemoryProjectInput {
  cwd: string;
  env: Record<string, string | undefined>;
  /** Parsed ovcli.conf object (the same file the official loader reads). */
  ovcli: Record<string, unknown>;
  /** The `dsh` section of ov.conf, the official legacy layer. */
  ovconfDsh: Record<string, unknown> | undefined;
  /** Version this client reports, for a workspace file's `min_client_version`. */
  clientVersion?: string;
  /** True when the user key saved in ovcli.conf is the local root key, which
   * the server refuses on `/mcp` from v0.5.2 on. */
  rootKeyCredential?: boolean;
  /** Peer id pinned by the user, resolved from env / ovcli.conf by the caller. */
  pinnedPeer?: { peerId: string; source: string };
}

/** Workspace keys worth reporting: the ones that change isolation, and the
 * tuning knobs this manager also exposes in ovcli.conf. */
const REPORTED_WORKSPACE_KEYS = [
  "peer.id",
  "peer.source",
  "recall.enabled",
  "recall.peer_scope",
  "recall.max_items",
  "recall.score_threshold",
  "capture.enabled",
] as const;

interface SettingsModule {
  resolveSettings?: (
    harness: string,
    options?: {
      env?: Record<string, string | undefined>;
      cwd?: string;
      legacy?: unknown;
      clientVersion?: string;
      cliFile?: unknown;
    },
  ) => { settings?: Record<string, unknown> };
  resolveWorkspaceSettings?: (
    cwd: string,
    env?: Record<string, string | undefined>,
    options?: { clientVersion?: string },
  ) => {
    settings?: Record<string, unknown>;
    root?: string;
    provenance?: Record<string, { source?: string; value?: unknown }>;
    warnings?: unknown[];
  };
}

interface PeerModule {
  resolveEffectivePeerId?: (input: {
    cfg?: unknown;
    cwd?: string;
    identity?: unknown;
    env?: Record<string, string | undefined>;
  }) => { peerId?: unknown; source?: unknown; origin?: unknown; legacyPeerId?: unknown };
}

export interface OfficialModules {
  settings?: SettingsModule;
  peer?: PeerModule;
  version: string;
}

let cached: Promise<OfficialModules | undefined> | undefined;

function stringOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function loadOfficial(): Promise<OfficialModules | undefined> {
  let entry: string;
  try {
    entry = import.meta.resolve("@openviking/dsh-memory-plugin");
  } catch {
    return undefined;
  }
  const load = async <T>(file: string): Promise<T | undefined> => {
    try {
      return (await import(new URL(`./shared/${file}`, entry).href)) as T;
    } catch {
      return undefined;
    }
  };
  const [settings, peer] = await Promise.all([load<SettingsModule>("plugin-config.mjs"), load<PeerModule>("workspace-peer.mjs")]);
  return { settings, peer, version: readOfficialVersion(entry) };
}

/** The official package version, used for `min_client_version` checks and for
 * capability gating in the UI. The package publishes `./package.json` from
 * 0.5.29 on; older installs simply report "". */
function readOfficialVersion(entry: string): string {
  try {
    const manifest = JSON.parse(readFileSync(new URL("./package.json", entry), "utf8")) as { version?: unknown };
    return stringOf(manifest.version);
  } catch {
    return "";
  }
}

/** Official modules, or undefined when the optional peer is not installed. */
export function officialModules(): Promise<OfficialModules | undefined> {
  cached ??= loadOfficial();
  return cached;
}

/** Test hook: drop the memoized module resolution. */
export function resetOfficialModules(): void {
  cached = undefined;
}

function emptyProject(cwd: string): MemoryProject {
  return {
    available: false,
    cwd,
    workspaceRoot: "",
    peer: "",
    peerOrigin: "",
    pinnedPeer: "",
    pinnedPeerSource: "",
    declarations: [],
    warnings: [],
    risks: [],
  };
}

/** Risk order: an error that silently widens recall comes first, then the
 * configuration mistakes that cost isolation, then the informational ones. */
const RISK_ORDER: ProjectRiskCode[] = [
  "workspace-scope-all",
  "workspace-disables-recall",
  "workspace-disables-capture",
  "pinned-peer",
  "workspace-pins-peer",
  "peer-id-conflict",
  "no-peer",
  "root-key-credential",
];

/** Resolve the project a session in `cwd` belongs to, the peer it will write
 * under, and every workspace declaration that outranks ovcli.conf. */
export async function readMemoryProject(input: MemoryProjectInput): Promise<MemoryProject> {
  const cwd = input.cwd;
  const modules = await officialModules();
  if (modules?.settings?.resolveSettings === undefined || modules.settings.resolveWorkspaceSettings === undefined) {
    return emptyProject(cwd);
  }
  // A workspace file's `min_client_version` is compared against the installed
  // official client; asking the caller to pass it would only invite drift.
  const clientVersion = input.clientVersion ?? modules.version;
  const { resolveSettings, resolveWorkspaceSettings } = modules.settings;

  const workspace = (() => {
    try {
      return resolveWorkspaceSettings(cwd, input.env, { clientVersion });
    } catch {
      return undefined;
    }
  })();

  const settings = (() => {
    try {
      return resolveSettings("dsh", {
        env: input.env,
        cwd,
        legacy: input.ovconfDsh ?? {},
        clientVersion,
        cliFile: input.ovcli,
      }).settings ?? {};
    } catch {
      return {};
    }
  })();

  const declarations: WorkspaceDeclaration[] = [];
  const provenance = workspace?.provenance ?? {};
  for (const key of REPORTED_WORKSPACE_KEYS) {
    const entry = provenance[key];
    if (entry === undefined) continue;
    declarations.push({ key, value: entry.value, layer: stringOf(entry.source) || "workspace" });
  }

  const pinned = input.pinnedPeer ?? { peerId: "", source: "" };
  let peer = "";
  let peerOrigin = "";
  if (modules.peer?.resolveEffectivePeerId !== undefined) {
    try {
      const resolved = modules.peer.resolveEffectivePeerId({ cfg: settings, cwd, env: input.env });
      peer = stringOf(resolved?.peerId);
      peerOrigin = stringOf(resolved?.origin) || stringOf(resolved?.source);
    } catch {
      peer = "";
    }
  }

  const declared = (key: string): unknown => declarations.find((item) => item.key === key)?.value;

  const risks: ProjectRisk[] = [];
  if (declared("recall.peer_scope") === "all") {
    risks.push({ code: "workspace-scope-all", severity: "error", values: { layer: layerOf("recall.peer_scope") } });
  }
  if (declared("recall.enabled") === false) {
    risks.push({ code: "workspace-disables-recall", severity: "warning", values: { layer: layerOf("recall.enabled") } });
  }
  if (declared("capture.enabled") === false) {
    risks.push({ code: "workspace-disables-capture", severity: "warning", values: { layer: layerOf("capture.enabled") } });
  }
  if (pinned.peerId !== "") {
    risks.push({ code: "pinned-peer", severity: "warning", values: { peerId: pinned.peerId, source: pinned.source } });
  }
  if (stringOf(declared("peer.id")) !== "") {
    risks.push({
      code: "workspace-pins-peer",
      severity: "warning",
      values: { peerId: stringOf(declared("peer.id")), layer: layerOf("peer.id") },
    });
  }
  if (pinned.peerId !== "" && peer !== "" && pinned.peerId !== peer) {
    risks.push({ code: "peer-id-conflict", severity: "warning", values: { pinned: pinned.peerId, peer } });
  }
  if (peer === "") {
    risks.push({
      code: "no-peer",
      severity: "warning",
      values: { cwd, root: stringOf(workspace?.root) },
    });
  }
  if (input.rootKeyCredential === true) {
    risks.push({ code: "root-key-credential", severity: "error" });
  }
  risks.sort((left, right) => RISK_ORDER.indexOf(left.code) - RISK_ORDER.indexOf(right.code));

  function layerOf(key: string): string {
    return declarations.find((item) => item.key === key)?.layer ?? "";
  }

  return {
    available: true,
    cwd,
    workspaceRoot: stringOf(workspace?.root),
    peer,
    peerOrigin,
    pinnedPeer: pinned.peerId,
    pinnedPeerSource: pinned.source,
    declarations,
    warnings: (workspace?.warnings ?? []).map((item) => String(item)),
    risks,
  };
}
