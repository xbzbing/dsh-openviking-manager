/** Hide the OpenViking `remember` tool from each live session's tool list.
 *
 * The tool has no peer argument, so an explicit call writes to the user-level
 * space instead of the session's project peer. The manager setting "MCP
 * remember" keeps it out of the model-facing schemas, which is stricter than
 * denying a call: the model never plans around a tool it cannot use. Automatic
 * capture carries the peer and is untouched.
 *
 * DSH only exposes `tools.restrict()` on an agent-scoped context, so the
 * restriction is installed per live agent. `tools/change` is the retry point:
 * the bridged MCP tools may register after an agent was created, and restricting
 * a name that does not exist yet fails until it does. */

/** Model-facing name of the bridged OpenViking tool that writes user-level
 * memories without a peer. Matches `mcp("remember")` in the official plugin. */
export const OPENVIKING_REMEMBER_TOOL = "mcp__openviking__remember";

/** Structural face of the live agent the restriction needs. DSH's Agent type
 * carries more, but the manager must keep loading on hosts whose typings are
 * older than the runtime. */
export interface RememberToolAgent {
  id: string;
  ctx?: {
    tools?: {
      restrict?(filter: { deny: readonly string[] }): () => void;
    };
  };
}

export interface RememberToolRestrictionOptions {
  /** Current manager policy; re-read on every sync so a saved toggle applies
   * to the next step without reloading the official plugin. */
  isBlocked(): boolean;
  /** Live agents when the host registry can be reached. Agents announced
   * through the events are tracked even when this is absent. */
  listAgents?(): readonly RememberToolAgent[];
  /** Called once per agent and failure; expected while the MCP tools have not
   * registered yet, so it is diagnostics rather than an error path. */
  onError?(error: unknown, agent: RememberToolAgent): void;
}

/** Per-agent `tools.restrict({ deny })` bookkeeping. */
export class RememberToolRestriction {
  private readonly tracked = new Map<string, RememberToolAgent>();
  private readonly disposers = new Map<string, () => void>();
  private readonly pending = new Set<string>();
  private readonly reported = new Set<string>();

  constructor(private readonly options: RememberToolRestrictionOptions) {}

  /** Track an agent announced by `agent/created` and apply the current policy. */
  remember(agent: RememberToolAgent): void {
    this.tracked.set(agent.id, agent);
    this.apply(agent);
  }

  /** Forget a disposed agent. Its scope already unwound the restriction, so the
   * disposer is not invoked here; a stale call could double-dispose a layer. */
  forget(id: string): void {
    this.tracked.delete(id);
    this.disposers.delete(id);
    this.reported.delete(id);
  }

  /** Reconcile every known agent with the current policy. Called after a
   * preference save and on every `tools/change` (a late MCP registration makes
   * the deny name valid). */
  sync(): void {
    const agents = new Map(this.tracked);
    for (const agent of this.options.listAgents?.() ?? []) agents.set(agent.id, agent);
    this.tracked.clear();
    for (const [id, agent] of agents) this.tracked.set(id, agent);

    if (!this.options.isBlocked()) {
      for (const agent of agents.values()) this.lift(agent);
      return;
    }
    for (const agent of agents.values()) this.apply(agent);
  }

  /** Lift every applied restriction without touching the policy. */
  dispose(): void {
    for (const agent of [...this.tracked.values()]) this.lift(agent);
    this.tracked.clear();
    this.reported.clear();
  }

  private apply(agent: RememberToolAgent): void {
    if (!this.options.isBlocked() || this.disposers.has(agent.id) || this.pending.has(agent.id)) return;
    this.pending.add(agent.id);
    try {
      // Service access on a context can throw when the scope does not expose
      // `tools`; that is a no-op here, never an agent-creation failure.
      const restrict = agent.ctx?.tools?.restrict;
      if (typeof restrict !== "function") return;
      const dispose = restrict.call(agent.ctx?.tools, { deny: [OPENVIKING_REMEMBER_TOOL] });
      if (typeof dispose === "function") {
        this.disposers.set(agent.id, dispose);
        this.reported.delete(agent.id);
      }
    } catch (error) {
      // Unknown names are normal while the MCP client is still listing its
      // tools; `tools/change` calls sync() again once they exist.
      if (!this.reported.has(agent.id)) {
        this.reported.add(agent.id);
        this.options.onError?.(error, agent);
      }
    } finally {
      this.pending.delete(agent.id);
    }
  }

  private lift(agent: RememberToolAgent): void {
    const dispose = this.disposers.get(agent.id);
    if (dispose === undefined) return;
    this.disposers.delete(agent.id);
    try {
      dispose();
    } catch (error) {
      this.options.onError?.(error, agent);
    }
  }
}
