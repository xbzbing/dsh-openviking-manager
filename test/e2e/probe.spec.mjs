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
    if (path === "/health") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: "ok" }));
    if (path === "/ready") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: "ready" }));
    if (path === "/api/v1/system/status" && req.headers.authorization === "Bearer keep-this-secret" && req.headers["x-openviking-account"] === "personal" && req.headers["x-openviking-user"] === "alice") {
      return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ result: { account: "personal", user: "alice" } }));
    }
    if (req.headers["x-api-key"] === "root-for-test" && path === "/api/v1/admin/accounts") {
      return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ result: [{ account_id: "personal" }, { account_id: "archive" }] }));
    }
    if (req.headers["x-api-key"] === "root-for-test" && path === "/api/v1/admin/accounts/personal/users") {
      return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ result: [{ user_id: "alice", role: "admin" }, { user_id: "bob", role: "user" }] }));
    }
    return res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "unauthorized" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function startManagerFixture(openVikingUrl) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ov-manager-e2e-probe-"));
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

test("verifies the existing server-side user key without showing it in the browser", async ({ page }) => {
  const openViking = await startOpenVikingFixture();
  const manager = await startManagerFixture(openViking.url);
  try {
    await page.goto(manager.url);
    await page.getByRole("button", { name: "Verify connection" }).click();
    await expect(page.getByRole("status")).toHaveText("Connected as personal/alice.");
    await expect(page.locator("body")).not.toContainText("keep-this-secret");
  } finally {
    await manager.close();
    await openViking.close();
  }
});
