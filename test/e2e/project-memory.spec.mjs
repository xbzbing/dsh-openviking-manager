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
  const options = { ovcliPath: configPath, env, preferencesPath: join(directory, "preferences.json") };
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

    const card = page.getByRole("region", { name: "Memory isolation rule" });
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
    const card = page.getByRole("region", { name: "Memory isolation rule" });
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
      const card = page.getByRole("region", { name: "Workspace status" });
      await expect(card).toBeVisible();

      // Folded by default: the rows only appear after the summary is opened.
      await expect(card.locator("li").first()).not.toBeVisible();
      await card.locator("summary").click();
      await expect(card.locator("li").first()).toBeVisible();

      // Line 1 is the path plus a status tag whose explanation is the tooltip;
      // line 2 is always the peer, so the two cannot be mistaken for each other.
      const shared = card.locator("li").filter({ has: page.locator("code", { hasText: cloneA }) });
      await expect(shared.locator(".ovm-workspaceHead code")).toHaveText(cloneA);
      await expect(shared.locator(".ovm-workspacePeer code")).toHaveText("github.com-example-shared");
      const sharedTag = shared.locator(".ovm-tag");
      await expect(sharedTag).toHaveText("Shared");
      await expect(sharedTag).toHaveAttribute("title", /checkout-b/);

      // A plain directory gets a namespace of its own, so it is isolated.
      const isolated = card.locator("li").filter({ has: page.locator("code", { hasText: playground }) });
      await expect(isolated.locator(".ovm-tag")).toHaveText("Isolated");
      await expect(isolated.locator(".ovm-tag")).toHaveAttribute("title", "Isolated: no other workspace resolves to this peer.");

      // The search filters the list locally, without another API round trip.
      const search = card.getByRole("searchbox");
      await search.fill("checkout-a");
      await expect(card.locator("li")).toHaveCount(1);
      await expect(card.locator("li")).toContainText(cloneA);
      await search.fill("no-such-workspace");
      await expect(card.locator("li")).toHaveCount(0);
      await expect(card).toContainText("No workspace matches");
      await search.fill("");
      await expect(card.locator("li")).toHaveCount(3);

      // The status filter is the shell's menu, not a native select; "All
      // statuses" resets it.
      const filter = card.getByRole("button", { name: "Filter workspaces by status" });
      await filter.click();
      await card.getByRole("menuitem", { name: "Shared" }).click();
      await expect(filter).toContainText("Shared");
      await expect(card.locator("li")).toHaveCount(2);
      await expect(card.locator(".ovm-tag")).toHaveText(["Shared", "Shared"]);
      await filter.click();
      await card.getByRole("menuitem", { name: "Isolated" }).click();
      await expect(card.locator("li")).toHaveCount(1);
      await expect(card).toContainText(playground);
      await filter.click();
      await card.getByRole("menuitem", { name: "User-level space" }).click();
      await expect(card.locator("li")).toHaveCount(0);
      await expect(card).toContainText("No workspace is in this state");
      await filter.click();
      await card.getByRole("menuitem", { name: "All statuses" }).click();
      await expect(card.locator("li")).toHaveCount(3);

      // Search and status compose instead of replacing one another.
      await filter.click();
      await card.getByRole("menuitem", { name: "Shared" }).click();
      await search.fill("checkout-b");
      await expect(card.locator("li")).toHaveCount(1);
      await expect(card).toContainText("checkout-b");
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
    await expect(page.getByRole("region", { name: "Memory isolation rule" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Workspace status" })).toHaveCount(0);
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
    const card = page.getByRole("region", { name: "Memory isolation rule" });
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


test("the project panel resolves a directory and names its peer", async ({ page }) => {
  const fixture = await startFixture({ initialConfig: { plugin: { dsh: { peerSource: "git" } } } });
  try {
    const checkout = await repo(fixture.directory, "panel-repo", "git@github.com:example/panel.git");
    const scratch = await plain(fixture.directory, "panel-scratch");
    await page.goto(fixture.url);

    const card = page.getByRole("region", { name: "Project memory isolation" });
    await card.getByLabel("Project directory").fill(checkout);
    await card.getByRole("button", { name: "Resolve" }).click();
    await expect(page.getByRole("status")).toContainText("Project resolved.");
    await expect(card).toContainText("github.com-example-panel");
    await expect(card).toContainText("Repository root");

    // Outside git the same rule yields no peer; the panel has to say so
    // instead of showing the previous project's namespace.
    await card.getByLabel("Project directory").fill(scratch);
    await card.getByRole("button", { name: "Resolve" }).click();
    await expect(card).toContainText("user-level space");
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});

test("a repository's peer.source and peer.id declarations are shown read-only", async ({ page }) => {
  const fixture = await startFixture({ initialConfig: { plugin: { dsh: { peerSource: RULE } } } });
  try {
    const checkout = await repo(fixture.directory, "declared-repo", "git@github.com:example/declared.git");
    await mkdir(join(checkout, ".openviking"), { recursive: true });
    await writeFile(
      join(checkout, ".openviking", "config.json"),
      JSON.stringify({ version: 1, peer: { source: "cwd", id: "team-shared" } }),
      "utf8",
    );
    await page.goto(fixture.url);

    const isolation = page.getByRole("region", { name: "Project memory isolation" });
    await isolation.getByLabel("Project directory").fill(checkout);
    await isolation.getByRole("button", { name: "Resolve" }).click();
    await expect(isolation).toContainText("team-shared");

    const rule = page.getByRole("region", { name: "Memory isolation rule" });
    const trigger = rule.getByRole("button", { name: "Peer source" });
    await expect(trigger).toBeDisabled();
    await expect(trigger).toContainText("Directory only");
    await expect(rule.getByRole("alert").filter({ hasText: "Overridden by a workspace file: peer.source" })).toBeVisible();
    // The attention copy names what "directory only" actually costs.
    await expect(rule.getByRole("alert").filter({ hasText: "Every directory is its own namespace" })).toBeVisible();

    const peerCard = page.getByRole("region", { name: "Project peer id (advanced)" });
    await peerCard.locator("summary").click();
    await expect(peerCard.getByLabel("Project peer id (advanced)")).toHaveValue("team-shared");
    await expect(peerCard.getByLabel("Project peer id (advanced)")).toBeDisabled();
    await expect(peerCard.getByRole("alert").filter({ hasText: "Overridden by a workspace file: peer.id" })).toBeVisible();
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});
