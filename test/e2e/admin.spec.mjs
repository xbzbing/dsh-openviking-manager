import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function startOpenVikingFixture() {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const key = req.headers["x-api-key"];
    const reply = (status, body) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    if (path === "/health") return reply(200, { status: "ok" });
    if (path === "/ready") return reply(200, { status: "ready" });
    if (path === "/api/v1/system/status" && key === "keep-this-secret") return reply(200, { result: { account: "personal", user: "alice" } });
    if (path === "/api/v1/admin/accounts" && key === "root-for-test") return reply(200, { result: [{ account_id: "personal" }, { account_id: "archive" }] });
    if (path === "/api/v1/admin/accounts/personal/users" && key === "root-for-test") return reply(200, { result: [{ user_id: "alice", role: "admin" }, { user_id: "bob", role: "user" }] });
    return reply(401, { error: "unauthorized" });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function startManagerFixture(openVikingUrl) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ov-manager-e2e-admin-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: openVikingUrl, api_key: "keep-this-secret", account: "personal", user: "alice" }), "utf8");
  const script = await readFile(join(root, "lib", "standalone.js"));
  const api = await import(join(root, "lib", "manager-api.js"));
  const routes = new Map(api.makeManagerRoutes({ ovcliPath: configPath }).map((route) => [route.path, route.handler]));
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/") return res.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>');
    if (url.pathname === "/app.js") return res.writeHead(200, { "content-type": "application/javascript" }).end(script);
    const handler = routes.get(url.pathname);
    if (handler) return handler(req, res);
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

test("lists existing accounts and users using one temporary root key", async ({ page }) => {
  const openViking = await startOpenVikingFixture();
  const manager = await startManagerFixture(openViking.url);
  try {
    await page.goto(manager.url);
    await page.getByLabel("Temporary root API key").fill("root-for-test");
    await page.getByRole("button", { name: "List accounts" }).click();
    await expect(page.getByText(/Found 2 account/)).toBeVisible();
    await page.getByLabel("Existing account").selectOption("personal");
    await expect(page.getByText(/Found 2 user\(s\) in personal/)).toBeVisible();
    await expect(page.getByLabel("Existing user")).toHaveValue("alice");
    await expect(page.locator("body")).not.toContainText("root-for-test");
  } finally {
    await manager.close();
    await openViking.close();
  }
});
