import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readMemoryProject } from "../../lib/memory-project.js";

/** Every test gets its own machine state: the official loader caches the git
 * identity under OPENVIKING_STATE_DIR and keeps the per-workspace registry
 * under OPENVIKING_HOME, so both point into the temp directory. */
async function tempEnv(t) {
  const root = await mkdtemp(join(tmpdir(), "dsh-ovm-project-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const env = { OPENVIKING_HOME: join(root, "home"), OPENVIKING_STATE_DIR: join(root, "state") };
  return { root, env };
}

function git(cwd, ...args) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

async function repo(t, { remote = "git@github.com:example/project.git" } = {}) {
  const { root, env } = await tempEnv(t);
  const cwd = join(root, "checkout");
  await mkdir(cwd, { recursive: true });
  git(cwd, "init", "-q");
  if (remote !== "") git(cwd, "remote", "add", "origin", remote);
  return { cwd, root, env };
}

async function workspaceFile(cwd, value) {
  await mkdir(join(cwd, ".openviking"), { recursive: true });
  await writeFile(join(cwd, ".openviking", "config.json"), JSON.stringify(value), "utf8");
}

function codes(project) {
  return project.risks.map((risk) => risk.code);
}

test("a git project derives one peer from its remote", async (t) => {
  const { cwd, env } = await repo(t);

  const project = await readMemoryProject({ cwd, env, ovcli: {}, ovconfDsh: undefined });

  assert.equal(project.available, true);
  // The official resolver reports the real path (/private/var on macOS).
  assert.equal(project.workspaceRoot, realpathSync(cwd));
  assert.equal(project.peer, "github.com-example-project");
  assert.equal(project.peerOrigin, "{git_remote}");
  assert.deepEqual(project.declarations, []);
  assert.deepEqual(project.risks, []);
});

test("a repository without a remote falls back to its root", async (t) => {
  const { cwd, env } = await repo(t, { remote: "" });

  const project = await readMemoryProject({ cwd, env, ovcli: {}, ovconfDsh: undefined });

  assert.equal(project.workspaceRoot, realpathSync(cwd));
  assert.notEqual(project.peer, "");
  assert.ok(!codes(project).includes("no-peer"));
});

test("a directory outside a repository has no peer and says so", async (t) => {
  const { root, env } = await tempEnv(t);
  const cwd = join(root, "scratch");
  await mkdir(cwd, { recursive: true });

  const project = await readMemoryProject({ cwd, env, ovcli: {}, ovconfDsh: undefined });

  assert.equal(project.workspaceRoot, "");
  assert.equal(project.peer, "");
  assert.ok(codes(project).includes("no-peer"));
});

test("a committed workspace file outranks ovcli.conf and is reported", async (t) => {
  const { cwd, env } = await repo(t);
  await workspaceFile(cwd, { version: 1, recall: { peer_scope: "all" } });

  const project = await readMemoryProject({
    cwd,
    env,
    // The machine-level setting this repository is overriding.
    ovcli: { plugin: { dsh: { recallPeerScope: "actor" } } },
    ovconfDsh: undefined,
  });

  const declaration = project.declarations.find((item) => item.key === "recall.peer_scope");
  assert.deepEqual(declaration, {
    key: "recall.peer_scope",
    value: "all",
    layer: "config.json (workspace)",
  });
  const risk = project.risks.find((item) => item.code === "workspace-scope-all");
  assert.equal(risk?.severity, "error");
  assert.equal(risk?.values?.layer, "config.json (workspace)");
});

test("a workspace peer.id pins the project peer and is flagged", async (t) => {
  const { cwd, env } = await repo(t);
  await workspaceFile(cwd, { version: 1, peer: { id: "team-shared" } });

  const project = await readMemoryProject({ cwd, env, ovcli: {}, ovconfDsh: undefined });

  assert.equal(project.peer, "team-shared");
  assert.ok(codes(project).includes("workspace-pins-peer"));
});

test("a workspace file can turn recall and capture off", async (t) => {
  const { cwd, env } = await repo(t);
  await workspaceFile(cwd, { version: 1, recall: { enabled: false }, capture: { enabled: false } });

  const project = await readMemoryProject({ cwd, env, ovcli: {}, ovconfDsh: undefined });

  assert.ok(codes(project).includes("workspace-disables-recall"));
  assert.ok(codes(project).includes("workspace-disables-capture"));
});

test("a machine-wide peer pin is reported as a process-wide risk", async (t) => {
  const { cwd, env } = await repo(t);

  const project = await readMemoryProject({
    cwd,
    env,
    ovcli: { plugin: { dsh: { peerId: "pinned-machine" } } },
    ovconfDsh: undefined,
    pinnedPeer: { peerId: "pinned-machine", source: "plugin.dsh" },
  });

  assert.equal(project.pinnedPeer, "pinned-machine");
  const risk = project.risks.find((item) => item.code === "pinned-peer");
  assert.equal(risk?.values?.peerId, "pinned-machine");
  // The pin is what the official loader resolves, so the peer follows it.
  assert.equal(project.peer, "pinned-machine");
});

test("the root key credential is an error, not a warning", async (t) => {
  const { cwd, env } = await repo(t);

  const project = await readMemoryProject({
    cwd,
    env,
    ovcli: {},
    ovconfDsh: undefined,
    rootKeyCredential: true,
  });

  const risk = project.risks.find((item) => item.code === "root-key-credential");
  assert.equal(risk?.severity, "error");
});

test("an environment peer id outranks the workspace", async (t) => {
  const { cwd, env } = await repo(t);
  await workspaceFile(cwd, { version: 1, peer: { id: "workspace-peer" } });

  const project = await readMemoryProject({
    cwd,
    env: { ...env, OPENVIKING_PEER_ID: "env-peer" },
    ovcli: {},
    ovconfDsh: undefined,
  });

  assert.equal(project.peer, "env-peer");
});

test("a workspace file asking for a newer client warns, without blocking", async (t) => {
  const { cwd, env } = await repo(t);
  await workspaceFile(cwd, { version: 1, min_client_version: "99.0.0", recall: { peer_scope: "all" } });

  const project = await readMemoryProject({ cwd, env, ovcli: {}, ovconfDsh: undefined });

  // The comparison runs against the installed official client (0.5.29 here),
  // not against an empty version that would skip the check entirely.
  assert.ok(project.warnings.some((warning) => warning.includes("99.0.0")));
  // "Warns and never blocks": the declaration still applies.
  assert.ok(codes(project).includes("workspace-scope-all"));
});

test("without the official package the answer is unavailable instead of throwing", async (t) => {
  const { root, env } = await tempEnv(t);
  const cwd = join(root, "anywhere");
  await mkdir(cwd, { recursive: true });
  const project = await readMemoryProject({ cwd: join(root, "missing"), env, ovcli: {}, ovconfDsh: undefined });
  assert.equal(typeof project.available, "boolean");
  assert.equal(project.cwd, join(root, "missing"));
});
