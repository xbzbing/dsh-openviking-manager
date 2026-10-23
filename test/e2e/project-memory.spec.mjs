import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

/** A manager API server over a throwaway ovcli.conf, with the official
 * loader's machine state (git-identity cache, workspace registry) redirected
 * into the same temp directory so the user's real one is never touched. */
async function startFixture({ initialConfig, env: extraEnv = {} } = {}) {
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
    const select = card.getByRole("combobox", { name: "Peer source" });
    await expect(select).toHaveValue("git-directory");
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
    const select = card.getByRole("combobox", { name: "Peer source" });
    await expect(select).toHaveValue("git");
    await expect(card.getByRole("alert").filter({ hasText: "shares the user-level space" })).toBeVisible();

    // Choosing the recommendation writes its templates and clears the warning.
    await select.selectOption("git-directory");
    await expect(select).toHaveValue("git-directory");
    await expect(card.getByRole("alert").filter({ hasText: "shares the user-level space" })).toHaveCount(0);
    expect(JSON.parse(await readFile(fixture.configPath, "utf8")).plugin.dsh.peerSource).toEqual(RULE);
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});
