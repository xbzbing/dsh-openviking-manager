/** Best-effort "what peer would the official plugin derive here" helper.
 *
 * The UI's "fill from current repository" button needs the same peer id the
 * official plugin would resolve for a session in this directory, so a user
 * pins exactly the automatic value rather than guessing at its sanitisation.
 * That derivation lives in the official package's `shared/workspace-peer.mjs`
 * and `workspace-identity.mjs`; this module reaches them through the package
 * entry URL — the same trick the runtime gate uses for `./runtime.mjs` — and
 * never reimplements the git-identity rules, so the two cannot drift.
 *
 * The official package is an optional peer, so every step degrades to "no
 * suggestion" rather than throwing: a missing module, a directory outside a
 * git repository, or a remote without a usable identity all yield "". */
export interface DerivedPeer {
    /** The peer id, or "" when this directory has none (not in a git repo, or
     * no usable remote) — which is exactly the case where leaving the field
     * empty and letting recall stay automatic is the right answer. */
    peerId: string;
}
/** Derive the peer id the official plugin would use for `cwd`. Defaults to the
 * host process's working directory, which is what the official runtime falls
 * back to for a session without its own cwd. */
export declare function derivePeerId(cwd?: string): Promise<DerivedPeer>;
