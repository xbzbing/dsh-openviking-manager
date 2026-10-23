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
  webServer: { register(route: WebRoute): () => void };
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
 * plugin refuse to load where it is absent. A missing registry yields an empty
 * list, and the panel then hides the section instead of guessing. */
function workspacePathsOf(host: HostContext): string[] {
  try {
    // `strict: false` also reads a service whose providing fiber is not active
    // in this context. The plain `ctx.workspaceRegistry` property throws
    // without `inject`, which is what made the list look empty.
    const registry = host.reflect?.get?.("workspaceRegistry", false) as
      | { list?: () => Array<{ path?: string }> }
      | undefined;
    const workspaces = registry?.list?.() ?? [];
    return workspaces
      .map((workspace) => (typeof workspace?.path === "string" ? workspace.path : ""))
      .filter((path) => path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path));
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
  host.effect(() => {
    // Restarting goes through the public cordis registry: it reloads the
    // official plugin so an ovcli.conf change is re-read without restarting
    // the DSH instance. The official code and behaviour stay untouched.
    const disposers = makeManagerRoutes({
      restartMemoryPlugin: () => restartOfficialOpenViking(ctx),
      workspacePaths: () => workspacePathsOf(host),
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
    ),
  ), "openviking-manager: gate OpenViking MCP tools");
}
