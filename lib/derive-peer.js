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
async function loadWorkspacePeerModule() {
    let entry;
    try {
        entry = import.meta.resolve("@openviking/dsh-memory-plugin");
    }
    catch {
        return undefined;
    }
    try {
        const href = new URL("./shared/workspace-peer.mjs", entry).href;
        return (await import(href));
    }
    catch {
        return undefined;
    }
}
/** Derive the peer id the official plugin would use for `cwd`. Defaults to the
 * host process's working directory, which is what the official runtime falls
 * back to for a session without its own cwd. */
export async function derivePeerId(cwd = process.cwd()) {
    const mod = await loadWorkspacePeerModule();
    if (mod?.resolveEffectivePeerId === undefined)
        return { peerId: "" };
    try {
        // `git` preset, no explicit pin: this asks purely "what does the workspace
        // git identity say", which is the automatic value the button should offer.
        const resolved = mod.resolveEffectivePeerId({ cfg: {}, cwd, env: process.env });
        const peerId = typeof resolved?.peerId === "string" ? resolved.peerId.trim() : "";
        return { peerId };
    }
    catch {
        return { peerId: "" };
    }
}
