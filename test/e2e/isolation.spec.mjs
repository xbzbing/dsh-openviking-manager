import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function startIsolationFixture({ restartMemoryPlugin, initialConfig } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ov-isolation-e2e-"));
  const configPath = join(directory, "ovcli.conf");
  const base = { url: "http://127.0.0.1:8008", api_key: "keep-this-secret", account: "personal", user: "alice" };
  await writeFile(configPath, JSON.stringify({ ...base, ...initialConfig }), { encoding: "utf8", mode: 0o600 });
  const script = await readFile(join(root, "lib", "standalone.js"));
  const api = await import(join(root, "lib", "manager-api.js"));
  const options = { ovcliPath: configPath, env: {} };
  if (restartMemoryPlugin) options.restartMemoryPlugin = restartMemoryPlugin;
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
    configPath,
    // Destroy idle keep-alive sockets before awaiting close so teardown never
    // waits out the browser connection's idle timeout.
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections?.();
      // A socket that is still finishing a request (or that the browser reuses
      // right after the idle sweep) keeps close() pending until it goes idle;
      // force it after a grace period so teardown can never eat the budget.
      setTimeout(() => server.closeAllConnections?.(), 500).unref();
    }),
  };
}

test("isolation is on by default, written on first load, and reloaded automatically", async ({ page }) => {
  let restarts = 0;
  const fixture = await startIsolationFixture({
    restartMemoryPlugin: async () => { restarts += 1; return { restarted: true, count: 1 }; },
  });
  try {
    await page.goto(fixture.url);
    const toggle = page.getByLabel("Disallow sharing memories across topics");
    await expect(toggle).toBeVisible();
    // The card warns up front that saving triggers an automatic reload.
    await expect(page.getByText("Saving reloads the official memory plugin automatically")).toBeVisible();

    // First load finds no key (official default `all`), so the product default
    // pins `actor` once and reloads — the switch ends up on.
    await expect(toggle).toBeChecked();
    await expect.poll(() => restarts).toBe(1);
    await expect(page.getByRole("status")).toContainText("The official memory plugin reloaded. The new setting is active.");
    const storedAfterInit = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(storedAfterInit.plugin.recallPeerScope).toBe("actor");
    expect(storedAfterInit.api_key).toBe("keep-this-secret");
    await expect(page.getByRole("button", { name: "Restart official memory plugin" })).toHaveCount(0);

    // Turning isolation off writes the key away and reloads again.
    await toggle.uncheck();
    await expect.poll(() => restarts).toBe(2);
    await expect(page.getByRole("status")).toContainText("The official memory plugin reloaded. The new setting is active.");
    const storedAfterDisable = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(storedAfterDisable.plugin.recallPeerScope).toBe(undefined);
    await expect(page.getByRole("button", { name: "Restart official memory plugin" })).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});

test("a failed automatic reload is reported on the status line; disabling then needs no reload", async ({ page }) => {
  const fixture = await startIsolationFixture();
  try {
    await page.goto(fixture.url);
    const toggle = page.getByLabel("Disallow sharing memories across topics");
    // First-load initialization wrote `actor`, but no plugin can reload here:
    // the outcome is a status line — no banner, no manual reload button.
    await expect(toggle).toBeChecked();
    await expect(page.getByRole("status")).toContainText("Restart the DSH instance manually");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Restart official memory plugin" })).toHaveCount(0);
    const storedAfterInit = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(storedAfterInit.plugin.recallPeerScope).toBe("actor");
    expect(storedAfterInit.api_key).toBe("keep-this-secret");

    // The running snapshot is still the official `all`, so writing `all` back
    // matches it: saved with no reload and the status line settles.
    await toggle.uncheck();
    await expect(page.getByRole("status")).toContainText("Memory isolation setting saved.");
    await expect(page.getByRole("alert")).toHaveCount(0);
    const storedAfterDisable = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(storedAfterDisable.plugin.recallPeerScope).toBe(undefined);
  } finally {
    await fixture.close();
  }
});

test("renders the isolation section in Simplified Chinese", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "language", { configurable: true, value: "zh-CN" });
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["zh-CN", "zh"] });
  });
  const fixture = await startIsolationFixture({
    restartMemoryPlugin: async () => ({ restarted: true, count: 1 }),
  });
  try {
    await page.goto(fixture.url);
    await expect(page.getByRole("heading", { name: "记忆隔离" })).toBeVisible();
    const toggle = page.getByLabel("不允许跨主题共享记忆");
    await expect(page.getByText("保存后会自动重新加载官方记忆插件")).toBeVisible();
    await expect(toggle).toBeChecked();
    await expect(page.getByRole("status")).toContainText("官方记忆插件已重新加载，新设置已生效。");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "重启官方记忆插件" })).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});
