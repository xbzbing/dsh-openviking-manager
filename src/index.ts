import type { Context } from "@deepseek-ai/cordis";
import type { WebRoute } from "@deepseek-ai/dsh-host-webserver";
import { makeManagerRoutes } from "./manager-api.js";
import {
  beginOpenVikingStep,
  endOpenVikingStep,
  isOpenVikingEnabledForActiveStep,
  isSessionOpenVikingEnabled,
} from "./session-toggle.js";
import { stripOpenVikingInjectedMessages } from "./ov-prestep.js";
import { openVikingToolDenialReason } from "./ov-tool-guard.js";
import { installOpenVikingRuntimeGate } from "./openviking-gate.js";
import { restartOfficialOpenViking } from "./openviking-restart.js";
import { loadUiPreferencesSync, resolveUiPreferencesPath } from "./ui-preferences.js";

export const name = "openviking-manager";
export const inject = ["webServer", "tools"];

type Decision = {
  kind: "enter" | "reject";
  messages: Array<{ source?: { kind?: string; plugin?: string } }>;
};
type AgentLike = { id?: string; session?: { id?: string } };
type HostContext = {
  effect(setup: () => void | (() => void), label: string): void;
  on(
    event: "agent/pre-step",
    listener: (payload: { agent: AgentLike; turn: number; step: number }, next: () => Promise<Decision>) => Promise<Decision>,
    options: { prepend: true },
  ): () => void;
  on(
    event: "session/event",
    listener: (session: { id?: string }, event: { type?: string }) => void,
  ): () => void;
  webServer: { register(route: WebRoute): () => void; getOrigin(): string };
  /** The reflection layer, used to *read* a service without declaring it a hard
   * dependency. `inject` has no optional form, so a plugin that needs the
   * workspace registry to load would disappear entirely on a host that does
   * not provide one. */
  reflect?: { get?: (name: string, strict?: boolean) => unknown };
  tools: { guard(guard: (exec: { name: string; agent?: AgentLike }) => string | undefined): () => void };
};

/** Absolute workspace directories the sidebar shows.
 *
 * Read through the reflection layer rather than `inject`: a service reached as
 * `ctx.workspaceRegistry` without being injected is not guaranteed to be
 * present, and `inject` has no optional form, so declaring it would make this
 * plugin refuse to load where it is absent. `undefined` means the host cannot
 * enumerate workspaces at all — distinct from an empty list, which is a host
 * that answered with no workspaces. The panel hides the section only for the
 * former. */
function workspacePathsOf(host: HostContext): string[] | undefined {
  try {
    // `strict: false` also reads a service whose providing fiber is not active
    // in this context. The plain `ctx.workspaceRegistry` property throws
    // without `inject`, which is what made the list look empty.
    const registry = host.reflect?.get?.("workspaceRegistry", false) as
      | { list?: () => Array<{ path?: string }> }
      | undefined;
    if (typeof registry?.list !== "function") return undefined;
    const workspaces = registry.list();
    if (!Array.isArray(workspaces)) return undefined;
    return workspaces
      .map((workspace) => (typeof workspace?.path === "string" ? workspace.path : ""))
      .filter((path) => path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path));
  } catch {
    return undefined;
  }
}

/** The origin this host is bound to, for the manager's Host fence. Loopback is
 * always accepted; this adds the LAN/TLS origin the server actually serves. A
 * reverse-proxy deployment can add its public name through
 * `DSH_OPENVIKING_MANAGER_ALLOWED_HOSTS`. */
function allowedHostsOf(host: HostContext): string[] {
  try {
    return [new URL(host.webServer.getOrigin()).host];
  } catch {
    return [];
  }
}

function agentSessionId(agent: AgentLike): string | undefined {
  return agent.id ?? agent.session?.id;
}

/** Mounts manager routes and a session-scoped OpenViking policy. The runtime
 * gate is installed synchronously; the later pre-step filter only defends
 * against version drift or an already-queued official injection. */
export function apply(ctx: Context): void {
  const host = ctx as unknown as HostContext;
  // The tool guard is synchronous, so the MCP remember policy is loaded once
  // here and kept current by the preferences route after a save. A malformed or
  // missing file keeps the backward-compatible default: allow explicit writes.
  const preferencesPath = resolveUiPreferencesPath();
  const rememberPolicy = { blocked: loadUiPreferencesSync(preferencesPath).disableMcpRemember };
  host.effect(() => {
    // Restarting goes through the public cordis registry: it reloads the
    // official plugin so an ovcli.conf change is re-read without restarting
    // the DSH instance. The official code and behaviour stay untouched.
    const disposers = makeManagerRoutes({
      restartMemoryPlugin: () => restartOfficialOpenViking(ctx),
      workspacePaths: () => workspacePathsOf(host),
      allowedHosts: allowedHostsOf(host),
      preferencesPath,
      onPreferencesSaved: (preferences) => {
        rememberPolicy.blocked = preferences.disableMcpRemember;
      },
    }).map((route) => host.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "openviking-manager: API routes");

  host.effect(() => {
    const restore = installOpenVikingRuntimeGate(
      isSessionOpenVikingEnabled,
      isOpenVikingEnabledForActiveStep,
    );
    return () => restore?.();
  }, "openviking-manager: OpenViking runtime gate");

  host.effect(() => {
    const dispose = host.on(
      "agent/pre-step",
      async (payload, next) => {
        const sessionId = agentSessionId(payload.agent);
        const enabled = beginOpenVikingStep(sessionId);
        const decision = await next();
        if (decision.kind !== "enter" || enabled) return decision;
        const messages = stripOpenVikingInjectedMessages(decision.messages);
        return messages.length === decision.messages.length ? decision : { ...decision, messages };
      },
      { prepend: true },
    );
    return () => dispose();
  }, "openviking-manager: snapshot OpenViking step policy");

  host.effect(() => {
    const dispose = host.on("session/event", (session, event) => {
      if (event.type === "turn/end") endOpenVikingStep(session.id);
    });
    return () => dispose();
  }, "openviking-manager: end OpenViking step policy");

  host.effect(() => host.tools.guard((exec) =>
    openVikingToolDenialReason(
      exec.name,
      isOpenVikingEnabledForActiveStep(exec.agent?.id),
      rememberPolicy.blocked,
    ),
  ), "openviking-manager: gate OpenViking MCP tools");
}
