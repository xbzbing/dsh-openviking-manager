import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function startPeerIdFixture({ restartMemoryPlugin, initialConfig, env } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ov-peer-e2e-"));
  const configPath = join(directory, "ovcli.conf");
  const base = { url: "http://127.0.0.1:8008", api_key: "keep-this-secret", account: "personal", user: "alice" };
  await writeFile(configPath, JSON.stringify({ ...base, ...initialConfig }), { encoding: "utf8", mode: 0o600 });
  const script = await readFile(join(root, "lib", "standalone.js"));
  const api = await import(join(root, "lib", "manager-api.js"));
  const options = { ovcliPath: configPath, env: env ?? {} };
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
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections?.();
      setTimeout(() => server.closeAllConnections?.(), 500).unref();
    }),
  };
}

test("peer id is empty by default and saving a value writes plugin.peerId then reloads", async ({ page }) => {
  let restarts = 0;
  const fixture = await startPeerIdFixture({
    restartMemoryPlugin: async () => { restarts += 1; return { restarted: true, count: 1 }; },
  });
  try {
    await page.goto(fixture.url);
    await page.getByRole("heading", { name: "Actor peer id (advanced)" }).click();
    const field = page.getByRole("textbox", { name: "Actor peer id (advanced)" });
    await expect(field).toBeVisible();
    await expect(field).toHaveValue("");
    // The multi-repository guidance and the "empty" explanation are shown.
    await expect(page.getByText("For multi-repository isolation, leave this empty")).toBeVisible();

    await field.fill("github.com-xbzbing-dsh-openviking-manager");
    await page.getByRole("button", { name: "Save peer id" }).click();
    await expect.poll(() => restarts).toBe(1);
    const stored = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(stored.plugin.peerId).toBe("github.com-xbzbing-dsh-openviking-manager");
    expect(stored.api_key).toBe("keep-this-secret");

    // Clearing restores automatic derivation by removing the key.
    await field.fill("");
    await page.getByRole("button", { name: "Save peer id" }).click();
    await expect.poll(async () => {
      const next = JSON.parse(await readFile(fixture.configPath, "utf8"));
      return "peerId" in (next.plugin ?? {});
    }).toBe(false);
  } finally {
    await fixture.close();
  }
});

test("an OPENVIKING_PEER_ID env override makes the field read-only with a warning", async ({ page }) => {
  const fixture = await startPeerIdFixture({ env: { OPENVIKING_PEER_ID: "env-peer" } });
  try {
    await page.goto(fixture.url);
    await page.getByRole("heading", { name: "Actor peer id (advanced)" }).click();
    const field = page.getByRole("textbox", { name: "Actor peer id (advanced)" });
    await expect(field).toHaveValue("env-peer");
    await expect(field).toBeDisabled();
    await expect(page.getByText("OPENVIKING_PEER_ID is set in the environment")).toBeVisible();
  } finally {
    await fixture.close();
  }
});

test("renders the peer id section in Simplified Chinese", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "language", { configurable: true, value: "zh-CN" });
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["zh-CN", "zh"] });
  });
  const fixture = await startPeerIdFixture({
    restartMemoryPlugin: async () => ({ restarted: true, count: 1 }),
  });
  try {
    await page.goto(fixture.url);
    await page.getByRole("heading", { name: "Actor peer id（高级）" }).click();
    await expect(page.getByText("如需多仓库工作时的记忆隔离，请留空")).toBeVisible();
    await expect(page.getByRole("button", { name: "填入当前仓库" })).toBeVisible();
  } finally {
    await fixture.close();
  }
});
