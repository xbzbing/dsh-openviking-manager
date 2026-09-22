/** Minimal DSH contracts consumed by the manager without making private Host
 * packages direct dependencies. These mirror the public Agent/Tool contracts:
 * Agent identity is `id`, and tool guards are monotonic after the waterfall. */

export interface PreStepDecisionLike {
  kind: "enter" | "reject";
  messages: Array<{ source?: { kind?: string; plugin?: string } }>;
  startsRequestSeries?: true;
}

export interface OpenVikingToolGuardExec {
  name: string;
  agent?: { id?: string; session?: { id?: string } } | undefined;
}

declare module "@deepseek-ai/cordis" {
  interface Events {
    "agent/pre-step"(
      payload: { agent: { id?: string; session?: { id?: string } }; turn: number; step: number },
      next: () => Promise<PreStepDecisionLike>,
    ): Promise<PreStepDecisionLike>;
    "session/event"(
      session: { id?: string },
      event: { type?: string },
    ): void;
  }
}
