import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function startIsolationFixture({ restartMemoryPlugin } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ov-isolation-e2e-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:8008", api_key: "keep-this-secret", account: "personal", user: "alice" }), { encoding: "utf8", mode: 0o600 });
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
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

test("turning cross-topic sharing off saves, auto-reloads, and applies the setting", async ({ page }) => {
  let restarts = 0;
  const fixture = await startIsolationFixture({
    restartMemoryPlugin: async () => { restarts += 1; return { restarted: true, count: 1 }; },
  });
  try {
    await page.goto(fixture.url);
    const toggle = page.getByLabel("Allow sharing memories across topics");
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked();
    // The card warns up front that saving triggers an automatic reload.
    await expect(page.getByText("Saving reloads the official memory plugin automatically")).toBeVisible();

    await toggle.uncheck();
    await expect(page.getByRole("status")).toContainText("The official memory plugin reloaded. The new setting is active.");
    // Automatic reload succeeded: no fallback banner, no manual button.
    await expect(page.getByRole("alert").filter({ hasText: "automatic reload did not complete" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Restart official memory plugin" })).toHaveCount(0);
    expect(restarts).toBe(1);

    const storedAfterSave = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(storedAfterSave.plugin.recallPeerScope).toBe("actor");
    expect(storedAfterSave.api_key).toBe("keep-this-secret");

    // Back to the official default: the key is removed and reloaded again.
    await toggle.check();
    // The status line still shows the previous round's identical success
    // text, so the restart counter is the only trustworthy wait here.
    await expect.poll(() => restarts).toBe(2);
    await expect(page.getByRole("status")).toContainText("The official memory plugin reloaded. The new setting is active.");
    const storedAfterReenable = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(storedAfterReenable.plugin.recallPeerScope).toBe(undefined);
    await expect(page.getByRole("alert").filter({ hasText: "automatic reload did not complete" })).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});

test("a failed automatic reload falls back to the manual button and manual advice", async ({ page }) => {
  const fixture = await startIsolationFixture();
  try {
    await page.goto(fixture.url);
    await page.getByLabel("Allow sharing memories across topics").uncheck();
    await expect(page.getByRole("status")).toContainText("Restart the DSH instance manually");
    // The file kept the change; the fallback banner offers the manual path.
    const banner = page.getByRole("alert").filter({ hasText: "automatic reload did not complete" });
    await expect(banner).toBeVisible();
    await page.getByRole("button", { name: "Restart official memory plugin" }).click();
    await expect(page.getByRole("status")).toContainText("Restart the DSH instance manually");
    const stored = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(stored.plugin.recallPeerScope).toBe("actor");
    expect(stored.api_key).toBe("keep-this-secret");
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
    await expect(page.getByLabel("允许跨主题共享记忆")).toBeChecked();
    await expect(page.getByText("保存后会自动重新加载官方记忆插件")).toBeVisible();
    await page.getByLabel("允许跨主题共享记忆").uncheck();
    await expect(page.getByRole("status")).toContainText("官方记忆插件已重新加载，新设置已生效。");
    await expect(page.getByRole("alert").filter({ hasText: "自动重新加载未完成" })).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});
