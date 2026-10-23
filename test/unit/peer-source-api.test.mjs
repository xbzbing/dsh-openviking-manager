import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeManagerRoutes } from "../../lib/manager-api.js";

const SOURCE_PATH = "/plugins/dsh-openviking-manager/api/peer-source";
const WORKSPACES_PATH = "/plugins/dsh-openviking-manager/api/workspaces";

async function withRoutes(t, ovcliPath, options = {}) {
  const routes = new Map(
    makeManagerRoutes({ ovcliPath, env: options.env ?? {}, ...options }).map((route) => [route.path, route.handler]),
  );
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const handler = routes.get(path);
    if (!handler) {
      res.writeHead(404).end();
      return;
    }
    handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections?.();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function call(base, path, { method = "GET", body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

/** A machine state of our own: the official loader caches git identity and the
 * workspace registry under these, so a test never reads the real ones. */
async function tempMachine(t) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-peer-source-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    configPath: join(directory, "ovcli.conf"),
    env: { OPENVIKING_HOME: join(directory, "home"), OPENVIKING_STATE_DIR: join(directory, "state") },
  };
}

function git(cwd, ...args) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

test("saving the rule writes the DSH section and leaves the shared one alone", async (t) => {
  const { configPath, env } = await tempMachine(t);
  await writeFile(configPath, JSON.stringify({
    api_key: "keep-this-secret",
    plugin: { peerSource: "directory", dsh: { recallPeerScope: "actor" } },
  }), "utf8");
  const base = await withRoutes(t, configPath, { env });

  const saved = await call(base, SOURCE_PATH, { method: "PUT", body: { peerSource: "git-directory" } });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.value.choice, "git-directory");
  assert.equal(saved.json.value.origin, "plugin.dsh");

  const stored = JSON.parse(await readFile(configPath, "utf8"));
  // The composite rule has no official preset name, so it is written as the
  // templates it stands for — the official loader would otherwise reject
  // "git-directory" as an unknown preset and fall back to `git`.
  assert.deepEqual(stored.plugin.dsh.peerSource, ["{git_remote}", "{git_root}", "{cwd}"]);
  // The other harnesses on this machine keep reading what they had.
  assert.equal(stored.plugin.peerSource, "directory");
  assert.equal(stored.plugin.dsh.recallPeerScope, "actor");
  assert.equal(stored.api_key, "keep-this-secret");
});

test("a custom template list is stored as a list, and a bad one is refused", async (t) => {
  const { configPath, env } = await tempMachine(t);
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:8008", api_key: "k" }), "utf8");
  const base = await withRoutes(t, configPath, { env });

  const saved = await call(base, SOURCE_PATH, { method: "PUT", body: { peerSource: ["{git_remote}", "team-{dir}"] } });
  assert.equal(saved.status, 200);
  assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")).plugin.dsh.peerSource, ["{git_remote}", "team-{dir}"]);
  assert.equal(saved.json.value.choice, "custom");

  const before = await readFile(configPath, "utf8");
  const refused = await call(base, SOURCE_PATH, { method: "PUT", body: { peerSource: ["team-{nope}"] } });
  assert.equal(refused.status, 400);
  assert.match(refused.json.error, /unknown peer\.source placeholder/);
  assert.equal(await readFile(configPath, "utf8"), before, "a rejected rule never reaches the file");
});

test("the workspace list reports which directories share one namespace", async (t) => {
  const { directory, configPath, env } = await tempMachine(t);
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:8008", api_key: "k" }), "utf8");

  // Two clones of one repository, one plain directory, and one repository
  // without a remote: the first two share, the rest stand alone.
  const cloneA = join(directory, "checkout-a");
  const cloneB = join(directory, "checkout-b");
  for (const cwd of [cloneA, cloneB]) {
    await mkdir(cwd, { recursive: true });
    git(cwd, "init", "-q");
    git(cwd, "remote", "add", "origin", "git@github.com:example/shared.git");
  }
  const localOnly = join(directory, "local-only");
  await mkdir(localOnly, { recursive: true });
  git(localOnly, "init", "-q");
  const plain = join(directory, "playground");
  await mkdir(plain, { recursive: true });

  // Without the directory fallback the plain folder has no namespace at all.
  const bare = await withRoutes(t, configPath, { env, workspacePaths: () => [cloneA, cloneB, plain] });
  const before = await call(bare, WORKSPACES_PATH);
  assert.equal(before.json.value.available, true);
  const plainBefore = before.json.value.workspaces.find((item) => item.path === plain);
  assert.equal(plainBefore.peer, "");
  assert.equal(plainBefore.userLevelSpace, true);

  // With it, each directory resolves its own peer and the clones still share.
  await call(bare, SOURCE_PATH, { method: "PUT", body: { peerSource: "git-directory" } });
  const after = await call(bare, WORKSPACES_PATH);
  const byPath = new Map(after.json.value.workspaces.map((item) => [item.path, item]));
  assert.equal(byPath.get(cloneA).peer, "github.com-example-shared");
  // Two clones of one repository are the same namespace, and the list says so.
  assert.deepEqual(byPath.get(cloneA).sharedWith, [cloneB]);
  assert.equal(byPath.get(plain).userLevelSpace, false, "a plain directory now has a namespace of its own");
  assert.notEqual(byPath.get(plain).peer, byPath.get(cloneA).peer);
});

test("a host that cannot enumerate workspaces says so instead of pretending", async (t) => {
  const { configPath, env } = await tempMachine(t);
  const base = await withRoutes(t, configPath, { env });
  const list = await call(base, WORKSPACES_PATH);
  assert.equal(list.status, 200);
  assert.equal(list.json.value.available, false);
  assert.deepEqual(list.json.value.workspaces, []);
});
