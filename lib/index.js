import { makeManagerRoutes } from "./manager-api.js";
import { beginOpenVikingStep, endOpenVikingStep, isOpenVikingEnabledForActiveStep, isSessionOpenVikingEnabled, } from "./session-toggle.js";
import { stripOpenVikingInjectedMessages } from "./ov-prestep.js";
import { openVikingToolDenialReason } from "./ov-tool-guard.js";
import { installOpenVikingRuntimeGate } from "./openviking-gate.js";
import { restartOfficialOpenViking } from "./openviking-restart.js";
export const name = "openviking-manager";
export const inject = ["webServer", "tools"];
function agentSessionId(agent) {
    return agent.id ?? agent.session?.id;
}
/** Mounts manager routes and a session-scoped OpenViking policy. The runtime
 * gate is installed synchronously; the later pre-step filter only defends
 * against version drift or an already-queued official injection. */
export function apply(ctx) {
    const host = ctx;
    host.effect(() => {
        // Restarting goes through the public cordis registry: it reloads the
        // official plugin so an ovcli.conf change is re-read without restarting
        // the DSH instance. The official code and behaviour stay untouched.
        const disposers = makeManagerRoutes({
            restartMemoryPlugin: () => restartOfficialOpenViking(ctx),
        }).map((route) => host.webServer.register(route));
        return () => {
            for (const dispose of disposers)
                dispose();
        };
    }, "openviking-manager: API routes");
    host.effect(() => {
        const restore = installOpenVikingRuntimeGate(isSessionOpenVikingEnabled, isOpenVikingEnabledForActiveStep);
        return () => restore?.();
    }, "openviking-manager: OpenViking runtime gate");
    host.effect(() => {
        const dispose = host.on("agent/pre-step", async (payload, next) => {
            const sessionId = agentSessionId(payload.agent);
            const enabled = beginOpenVikingStep(sessionId);
            const decision = await next();
            if (decision.kind !== "enter" || enabled)
                return decision;
            const messages = stripOpenVikingInjectedMessages(decision.messages);
            return messages.length === decision.messages.length ? decision : { ...decision, messages };
        }, { prepend: true });
        return () => dispose();
    }, "openviking-manager: snapshot OpenViking step policy");
    host.effect(() => {
        const dispose = host.on("session/event", (session, event) => {
            if (event.type === "turn/end")
                endOpenVikingStep(session.id);
        });
        return () => dispose();
    }, "openviking-manager: end OpenViking step policy");
    host.effect(() => host.tools.guard((exec) => openVikingToolDenialReason(exec.name, isOpenVikingEnabledForActiveStep(exec.agent?.id))), "openviking-manager: gate OpenViking MCP tools");
}
