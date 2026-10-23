import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

/** A manager API server over a throwaway ovcli.conf, with the official
 * loader's machine state (git-identity cache, workspace registry) redirected
 * into the same temp directory so the user's real one is never touched. */
async function startFixture({ workspacePaths, initialConfig, env: extraEnv = {} } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-project-e2e-"));
  const configPath = join(directory, "ovcli.conf");
  const base = { url: "http://127.0.0.1:8008", api_key: "keep-this-secret", account: "personal", user: "alice" };
  await writeFile(configPath, JSON.stringify({ ...base, ...initialConfig }), { encoding: "utf8", mode: 0o600 });
  const script = await readFile(join(root, "lib", "standalone.js"));
  const api = await import(join(root, "lib", "manager-api.js"));
  // The git-identity cache and the workspace registry live under these, so a
  // test never reads the machine's real ones.
  const env = {
    OPENVIKING_HOME: join(directory, "home"),
    OPENVIKING_STATE_DIR: join(directory, "state"),
    ...extraEnv,
  };
  const options = { ovcliPath: configPath, env };
  if (workspacePaths) options.workspacePaths = workspacePaths;
  const routes = new Map(api.makeManagerRoutes(options).map((route) => [route.path, route.handler]));
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end('<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>');
      return;
    }
    if (url.pathname === "/app.js") {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end(script);
      return;
    }
    const handler = routes.get(url.pathname);
    if (handler) return handler(req, res);
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    directory,
    configPath,
    cleanup: () => rm(directory, { recursive: true, force: true }),
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections?.();
      setTimeout(() => server.closeAllConnections?.(), 500).unref();
    }),
  };
}

function git(cwd, ...args) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

async function repo(directory, name, remote) {
  const cwd = join(directory, name);
  await mkdir(cwd, { recursive: true });
  git(cwd, "init", "-q");
  if (remote) git(cwd, "remote", "add", "origin", remote);
  return cwd;
}

async function plain(directory, name) {
  const cwd = join(directory, name);
  await mkdir(cwd, { recursive: true });
  return cwd;
}

/** The recommended rule, as it is stored: the official loader has no preset
 * name for it, so the file carries the templates themselves. */
const RULE = ["{git_remote}", "{git_root}", "{cwd}"];

test("the first load pins the recommended rule, and the card explains it", async ({ page }) => {
  const fixture = await startFixture();
  try {
    await page.goto(fixture.url);

    const card = page.getByRole("region", { name: "Which directories share memories" });
    await expect(card).toBeVisible();
    // It must not read like a per-project setting.
    await expect(card).toContainText("the official plugin derives one peer per session");

    // A bare file is a product default like the isolation switch: the first
    // load writes the recommended rule, so a workspace outside git is isolated
    // without anyone visiting this page and choosing it.
    const trigger = card.getByRole("button", { name: "Peer source" });
    await expect(trigger).toContainText("Repository first");
    await expect.poll(async () => JSON.parse(await readFile(fixture.configPath, "utf8")).plugin?.dsh?.peerSource)
      .toEqual(RULE);

    const stored = JSON.parse(await readFile(fixture.configPath, "utf8"));
    // The shared section belongs to the other harnesses and stays untouched.
    expect(stored.plugin.peerSource).toBeUndefined();
    expect(stored.api_key).toBe("keep-this-secret");
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});

test("the card warns when the rule leaves non-repository directories sharing space", async ({ page }) => {
  // The official default, pinned explicitly: every directory outside a
  // repository then lands in the user-level space, which is worth saying.
  const fixture = await startFixture({ initialConfig: { plugin: { dsh: { peerSource: "git" } } } });
  try {
    await page.goto(fixture.url);
    const card = page.getByRole("region", { name: "Which directories share memories" });
    const trigger = card.getByRole("button", { name: "Peer source" });
    await expect(trigger).toContainText("Repository only");
    await expect(card.getByRole("alert").filter({ hasText: "shares the user-level space" })).toBeVisible();

    // Choosing the recommendation writes its templates and clears the warning.
    await trigger.click();
    await card.getByRole("menuitem", { name: /Repository first/ }).click();
    await expect(trigger).toContainText("Repository first");
    await expect(card.getByRole("alert").filter({ hasText: "shares the user-level space" })).toHaveCount(0);
    expect(JSON.parse(await readFile(fixture.configPath, "utf8")).plugin.dsh.peerSource).toEqual(RULE);
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});

test("the workspace list says which directories share one namespace", async ({ page }) => {
  const fixture = await startFixture();
  try {
    // Two clones of one repository, plus a plain directory outside git.
    const cloneA = await repo(fixture.directory, "checkout-a", "git@github.com:example/shared.git");
    const cloneB = await repo(fixture.directory, "checkout-b", "git@github.com:example/shared.git");
    const playground = await plain(fixture.directory, "playground");
    const workspaces = [cloneA, cloneB, playground];

    // The list comes from the host's registry, so the fixture supplies it.
    await fixture.close();
    const listed = await startFixture({
      workspacePaths: () => workspaces,
      initialConfig: { plugin: { peerSource: RULE } },
    });
    try {
      await page.goto(listed.url);
      const card = page.getByRole("region", { name: "Your workspaces" });
      await expect(card).toBeVisible();

      // Each row's own path is its <code>; a sibling's name also appears in the
      // "shares with" line, so match on the path element, not the row text.
      const shared = card.locator("li").filter({ has: page.locator("code", { hasText: cloneA }) });
      await expect(shared).toContainText("github.com-example-shared");
      await expect(shared).toContainText("Shares memories with");
      await expect(shared).toContainText("checkout-b");

      // A plain directory gets a namespace of its own, so it is isolated.
      const isolated = card.locator("li").filter({ has: page.locator("code", { hasText: playground }) });
      await expect(isolated).toContainText("Isolated");
      await expect(isolated).not.toContainText("user-level space");
    } finally {
      await listed.close();
      await listed.cleanup();
    }
  } finally {
    await fixture.cleanup();
  }
});

test("a host that cannot enumerate workspaces hides the list instead of guessing", async ({ page }) => {
  const fixture = await startFixture();
  try {
    await page.goto(fixture.url);
    // The rule card still renders; only the inspection needs the registry.
    await expect(page.getByRole("region", { name: "Which directories share memories" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your workspaces" })).toHaveCount(0);
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});

test("an environment override makes the rule card read-only", async ({ page }) => {
  const fixture = await startFixture({
    initialConfig: { plugin: { peerSource: RULE } },
    env: { OPENVIKING_PEER_SOURCE: "none" },
  });
  try {
    await page.goto(fixture.url);
    const card = page.getByRole("region", { name: "Which directories share memories" });
    const trigger = card.getByRole("button", { name: "Peer source" });
    // The environment outranks any file this plugin can write, so the control
    // is read-only and the page says why.
    await expect(trigger).toBeDisabled();
    await expect(trigger).toContainText("Off");
    await expect(card.getByRole("alert").filter({ hasText: "OPENVIKING_PEER_SOURCE" })).toBeVisible();
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});
