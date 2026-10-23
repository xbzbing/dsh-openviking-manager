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
async function startFixture() {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-project-e2e-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(
    configPath,
    JSON.stringify({ url: "http://127.0.0.1:8008", api_key: "keep-this-secret", account: "personal", user: "alice" }),
    { encoding: "utf8", mode: 0o600 },
  );
  const script = await readFile(join(root, "lib", "standalone.js"));
  const api = await import(join(root, "lib", "manager-api.js"));
  const env = {
    OPENVIKING_HOME: join(directory, "home"),
    OPENVIKING_STATE_DIR: join(directory, "state"),
  };
  const routes = new Map(api.makeManagerRoutes({ ovcliPath: configPath, env }).map((route) => [route.path, route.handler]));
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
    cleanup: () => rm(directory, { recursive: true, force: true }),
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections?.();
      setTimeout(() => server.closeAllConnections?.(), 500).unref();
    }),
  };
}

async function gitRepo(directory, workspaceConfig) {
  const cwd = join(directory, "checkout");
  await mkdir(cwd, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd, stdio: "ignore" });
  execFileSync("git", ["remote", "add", "origin", "git@github.com:example/project.git"], { cwd, stdio: "ignore" });
  await mkdir(join(cwd, ".openviking"), { recursive: true });
  await writeFile(join(cwd, ".openviking", "config.json"), JSON.stringify(workspaceConfig), "utf8");
  return cwd;
}

test("a repository that widens recall is reported as an isolation risk", async ({ page }) => {
  const fixture = await startFixture();
  try {
    const cwd = await gitRepo(fixture.directory, { version: 1, recall: { peer_scope: "all" } });
    await page.goto(fixture.url);

    // The card renders for the host directory first; point it at the repository.
    const input = page.getByLabel("Project directory");
    await expect(input).toBeVisible();
    await input.fill(cwd);
    await page.getByRole("button", { name: "Resolve" }).click();

    // The declaration is named, with the layer that won.
    await expect(page.getByText("Repository declarations (they outrank this machine's settings)")).toBeVisible();
    await expect(page.getByText("config.json (workspace)").first()).toBeVisible();
    // …and the switch tells the truth about the effective value.
    await expect(page.getByRole("switch", { name: "Disallow recalling memories from other projects" })).not.toBeChecked();
    // The bypass is called out as an error, not a hint.
    await expect(page.getByText(/sets recall\.peer_scope to all/)).toBeVisible();
    await expect(page.getByText("github.com-example-project")).toBeVisible();
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});

test("a directory outside a repository reports the user-level fallback", async ({ page }) => {
  const fixture = await startFixture();
  try {
    const scratch = join(fixture.directory, "scratch");
    await mkdir(scratch, { recursive: true });
    await page.goto(fixture.url);

    await page.getByLabel("Project directory").fill(scratch);
    await page.getByRole("button", { name: "Resolve" }).click();

    await expect(page.getByText("not inside a git repository")).toBeVisible();
    await expect(page.getByText("user-level space (no project namespace)")).toBeVisible();
    await expect(page.getByText(/No peer is derived for/)).toBeVisible();
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});

test("a repository that pins its own peer is reported", async ({ page }) => {
  const fixture = await startFixture();
  try {
    const cwd = await gitRepo(fixture.directory, { version: 1, peer: { id: "team-shared" } });
    await page.goto(fixture.url);

    await page.getByLabel("Project directory").fill(cwd);
    await page.getByRole("button", { name: "Resolve" }).click();

    await expect(page.getByText(/pins the peer "team-shared" for this project/)).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: "team-shared" })).toBeVisible();
  } finally {
    await fixture.close();
    await fixture.cleanup();
  }
});
