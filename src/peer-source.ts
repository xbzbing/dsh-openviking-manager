import { readOvcliObject, writeOvcliObject } from "./ovcli-config.js";
import { harnessSection, pluginSection } from "./recall-scope.js";

/** Config-face editing for `peer.source`, the knob that decides *which*
 * directories share one memory namespace.
 *
 * The official preset `git` — its default — resolves `{git_remote}` then
 * `{git_root}`, so a repository is one namespace across clones and machines.
 * Anywhere else it resolves to nothing, and a session with no peer writes to
 * the user-level space that every non-repository directory shares. That is the
 * behaviour the panel has to change for a workspace directory that is not a
 * git repository: it should still be its own namespace.
 *
 * `peer.source` also accepts a template or a list of templates tried in order
 * (see the official `peerSourceTemplates`). The list below therefore keeps the
 * repository identity first — so clones and machines still share — and falls
 * back to the directory itself, which is what isolates a plain folder:
 *
 *   git            ["{git_remote}", "{git_root}"]                  official default
 *   git-directory  ["{git_remote}", "{git_root}", "{cwd}"]         this panel's product default
 *   directory      ["{cwd}"]                                       every directory separate
 *   none           []                                              user-level space
 *
 * `{cwd}` is the session's own working directory, which for a DSH workspace is
 * that workspace's directory — the sidebar entry the user picked.
 *
 * Resolution order mirrors the other config faces; the workspace layers sit
 * above this file and are reported by `readMemoryProject`, not merged here. */

export type PeerSourceKey = "git" | "git-directory" | "cwd" | "none";
export type PeerSourceOrigin = "env" | "plugin.dsh" | "plugin" | "default";

export const PEER_SOURCE_ENV = "OPENVIKING_PEER_SOURCE";
export const DEFAULT_PEER_SOURCE_KEY: PeerSourceKey = "git";

/** The templates each named choice writes. Values come from the official
 * `PEER_SOURCE_PRESETS` plus the git-then-directory list this panel adds. */
export const PEER_SOURCE_TEMPLATES: Record<PeerSourceKey, string[]> = {
  // `git`, `cwd` and `none` are the official preset names, so they can be
  // stored by name and stay readable in the file.
  git: ["{git_remote}", "{git_root}"],
  cwd: ["{cwd}"],
  none: [],
  // The composite rule is this panel's product default. The official loader
  // has no preset for it, so it is stored as the template list it stands for —
  // a bare "git-directory" would be an unknown preset and silently fall back.
  "git-directory": ["{git_remote}", "{git_root}", "{cwd}"],
};

/** Presets the official `peerSourceTemplates` recognises by name. Anything
 * else must be stored as templates. */
const OFFICIAL_PRESET_NAMES = new Set(["git", "cwd", "none"]);

/** What the panel writes on first load when no layer supplies the key: one
 * namespace per workspace directory, including the ones that are not
 * repositories. */
export const PRODUCT_PEER_SOURCE: PeerSourceKey = "git-directory";

/** Variables the official `renderPeerTemplate` understands. A submitted list is
 * refused unless every placeholder is one of these — an unknown name renders
 * empty, which would silently collapse the peer to a lower template. */
const TEMPLATE_VARS = new Set(["git_remote", "git_root", "cwd", "dir", "harness"]);

const MAX_TEMPLATE_CHARS = 200;
const MAX_TEMPLATES = 8;

export interface PeerSourceView {
  /** The choice that describes the effective templates, when one matches. */
  choice: PeerSourceKey | "custom";
  /** The effective templates, in the order the official loader tries them. */
  templates: string[];
  origin: PeerSourceOrigin;
  /** Raw env value when the environment is the effective layer. */
  envOverride: string;
  /** Raw value another harness left in the shared `plugin` section, if any. */
  sharedValue: string;
  /** The panel's recommendation, offered as one click. */
  recommended: PeerSourceKey;
  /** False once every choice is already in force — the UI then offers nothing. */
  needsAttention: boolean;
}

/** Templates → the named choice they correspond to, or "custom". */
export function choiceOf(templates: string[]): PeerSourceKey | "custom" {
  for (const [choice, known] of Object.entries(PEER_SOURCE_TEMPLATES) as Array<[PeerSourceKey, string[]]>) {
    if (known.length === templates.length && known.every((item, index) => item === templates[index])) return choice;
  }
  return "custom";
}

/** Normalize whatever a layer carries into templates, following the official
 * `peerSourceTemplates`: an empty value means the preset default, a bare word
 * naming a preset expands to it, and anything else is a template (or a list). */
export function peerSourceTemplates(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  if (typeof value !== "string") return PEER_SOURCE_TEMPLATES[DEFAULT_PEER_SOURCE_KEY];
  const raw = value.trim();
  if (raw === "") return PEER_SOURCE_TEMPLATES[DEFAULT_PEER_SOURCE_KEY];
  if (raw in PEER_SOURCE_TEMPLATES) return PEER_SOURCE_TEMPLATES[raw as PeerSourceKey];
  return [raw];
}

/** A layer may carry a preset name or a list of templates. */
function rawValue(value: unknown): unknown {
  if (typeof value === "string") return value.trim() === "" ? undefined : value.trim();
  if (Array.isArray(value) && value.length > 0) return value;
  return undefined;
}

/** `peerSource` then its alias `peer_source`, within one section. */
function peerSourceIn(section: Record<string, unknown> | undefined): unknown {
  if (section === undefined) return undefined;
  const direct = rawValue(section.peerSource);
  if (direct !== undefined) return direct;
  return rawValue(section.peer_source);
}

/** How a raw layer value is shown to the reader. */
export function describePeerSource(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(" → ");
  return typeof value === "string" ? value : "";
}

/** The effective `peer.source`, lowest layer upwards. */
export function effectivePeerSource(
  config: Record<string, unknown>,
  env: Record<string, string | undefined> = {},
): { templates: string[]; origin: PeerSourceOrigin; envOverride: string; sharedValue: string } {
  const sharedValue = describePeerSource(peerSourceIn(pluginSection(config)));
  const rawEnv = env[PEER_SOURCE_ENV]?.trim() ?? "";
  if (rawEnv !== "") {
    return { templates: peerSourceTemplates(rawEnv), origin: "env", envOverride: rawEnv, sharedValue };
  }
  const fromHarness = peerSourceIn(harnessSection(config));
  if (fromHarness !== undefined) {
    return { templates: peerSourceTemplates(fromHarness), origin: "plugin.dsh", envOverride: "", sharedValue };
  }
  const fromShared = peerSourceIn(pluginSection(config));
  if (fromShared !== undefined) {
    return { templates: peerSourceTemplates(fromShared), origin: "plugin", envOverride: "", sharedValue };
  }
  return {
    templates: PEER_SOURCE_TEMPLATES[DEFAULT_PEER_SOURCE_KEY],
    origin: "default",
    envOverride: "",
    sharedValue,
  };
}

/** Validate a submitted choice or template list. Returns the JSON value to
 * store: a preset name when one matches, otherwise the template array itself
 * (the official loader reads `peer.source` as a string *or* a list). Throws on
 * input the official renderer would resolve to nothing. */
export function normalizePeerSource(value: unknown): string | string[] {
  // Only a name the official loader knows may be stored as a name; the panel's
  // own composite rule has to be written out as its templates.
  if (typeof value === "string" && OFFICIAL_PRESET_NAMES.has(value.trim())) return value.trim();
  // A blank entry is almost always a typo, and silently dropping it would turn
  // "one namespace per directory" into "no peer at all". `none` is the explicit
  // way to ask for that.
  if (Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim() === "")) {
    throw new Error("peer.source templates must not be blank");
  }
  const templates = peerSourceTemplates(value);
  if (templates.length === 0) return "none";
  if (templates.length > MAX_TEMPLATES) throw new Error(`peer.source accepts at most ${MAX_TEMPLATES} templates`);
  for (const template of templates) {
    if (template.length > MAX_TEMPLATE_CHARS) throw new Error(`each peer.source template must be at most ${MAX_TEMPLATE_CHARS} characters`);
    for (const match of template.matchAll(/\{([^}]*)\}/g)) {
      const name = match[1] ?? "";
      if (!TEMPLATE_VARS.has(name)) {
        throw new Error(`unknown peer.source placeholder "${name}"; use one of ${[...TEMPLATE_VARS].join(", ")}`);
      }
    }
    // A template with no placeholder still renders that literal text, which is
    // a legitimate (if unusual) namespace name.
    if (template.trim() === "") throw new Error("peer.source templates must not be blank");
  }
  const choice = choiceOf(templates);
  if (choice !== "custom" && OFFICIAL_PRESET_NAMES.has(choice)) return choice;
  return templates;
}

export async function peerSourceView(
  path: string,
  options: { env?: Record<string, string | undefined> } = {},
): Promise<PeerSourceView> {
  const env = options.env ?? process.env;
  const config = await readOvcliObject(path);
  const effective = effectivePeerSource(config, env);
  const choice = choiceOf(effective.templates);
  const draft: PeerSourceView = {
    choice,
    templates: effective.templates,
    origin: effective.origin,
    envOverride: effective.envOverride,
    sharedValue: effective.sharedValue,
    recommended: PRODUCT_PEER_SOURCE,
    needsAttention: false,
  };
  return { ...draft, needsAttention: needsAttention(draft) };
}

/** True when the panel should nudge: the effective templates either leave
 * non-repository directories with no peer at all, or isolate every directory
 * even inside one repository (which splits a clone from its siblings). */
export function needsAttention(view: Pick<PeerSourceView, "templates" | "choice">): boolean {
  if (view.templates.length === 0) return true;
  // A repository identity in front keeps clones and machines together; without
  // it, a checkout mints a fresh namespace per path.
  const hasRepositoryIdentity = view.templates.some((item) => item.includes("{git_remote}") || item.includes("{git_root}"));
  const hasDirectoryFallback = view.templates.some((item) => item.includes("{cwd}") || item.includes("{dir}"));
  return !(hasRepositoryIdentity && hasDirectoryFallback);
}

/** Write the choice to the DSH-scoped section. The shared `plugin` section
 * belongs to the other harnesses and is left alone. */
export async function savePeerSource(path: string, value: string | string[]): Promise<void> {
  const existing = await readOvcliObject(path);
  const shared = pluginSection(existing);
  if (existing.plugin !== undefined && shared === undefined) {
    throw new Error('ovcli.conf "plugin" section must be an object');
  }
  const nextShared: Record<string, unknown> = { ...(shared ?? {}) };
  const harness = typeof nextShared.dsh === "object" && nextShared.dsh !== null && !Array.isArray(nextShared.dsh)
    ? (nextShared.dsh as Record<string, unknown>)
    : {};
  const { peerSource: _peerSource, peer_source: _alias, ...rest } = harness;
  const nextHarness: Record<string, unknown> = { ...rest, peerSource: value };
  nextShared.dsh = nextHarness;
  await writeOvcliObject(path, { ...existing, plugin: nextShared });
}

/** The JSON value a choice stores: the official preset name when one exists,
 * otherwise the template list. */
export function storedValueFor(choice: PeerSourceKey): string | string[] {
  return OFFICIAL_PRESET_NAMES.has(choice) ? choice : PEER_SOURCE_TEMPLATES[choice];
}
