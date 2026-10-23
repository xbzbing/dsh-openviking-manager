import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function startOpenVikingFixture({ delayMs = 0, statusResult = { account: "personal", user: "alice" } } = {}) {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    // A slow data plane is how the in-flight state becomes observable.
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (path === "/health") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: "ok" }));
    if (path === "/ready") return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ status: "ready" }));
    if (path === "/api/v1/system/status" && req.headers.authorization === "Bearer keep-this-secret" && req.headers["x-openviking-account"] === "personal" && req.headers["x-openviking-user"] === "alice") {
      return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ result: statusResult }));
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

async function startManagerFixture(openVikingUrl, { restartMemoryPlugin, restartTimeoutMs, seedPluginDefaults = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ov-manager-e2e-probe-"));
  const configPath = join(directory, "ovcli.conf");
  // The first-load initialisation pins the isolation switch and the product
  // tuning defaults, then reports the reload outcome on the status line. These
  // keys are pre-seeded so that pass is a no-op: the tests below assert their
  // own action's status, which a background reload notice would overwrite.
  // `seedPluginDefaults: false` keeps the file bare, which is what triggers
  // that pass — the case where a slow reload used to disable every control.
  const document = {
    url: openVikingUrl,
    api_key: "keep-this-secret",
    account: "personal",
    user: "alice",
    ...(seedPluginDefaults
      ? { plugin: { dsh: { recallPeerScope: "actor", scoreThreshold: 0.5, recallQueryExpansion: "off", timeoutMs: 15000 } } }
      : {}),
  };
  await writeFile(configPath, JSON.stringify(document), "utf8");
  const script = await readFile(join(root, "lib", "standalone.js"));
  const api = await import(join(root, "lib", "manager-api.js"));
  const options = { ovcliPath: configPath };
  if (restartMemoryPlugin) options.restartMemoryPlugin = restartMemoryPlugin;
  if (restartTimeoutMs !== undefined) options.restartTimeoutMs = restartTimeoutMs;
  const routes = new Map(api.makeManagerRoutes(options).map((route) => [route.path, route.handler]));
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

test("verifies the existing server-side user key without showing it in the browser", async ({ page }) => {
  const openViking = await startOpenVikingFixture();
  const manager = await startManagerFixture(openViking.url);
  try {
    await page.goto(manager.url);
    await page.getByRole("button", { name: "Verify connection" }).click();
    // The answer lands beside the button that asked, not on the status line,
    // which the reload notices own.
    const result = page.locator(".ovm-verifyResult");
    await expect(result).toHaveText("Connected as personal/alice.");
    await expect(page.getByRole("status")).not.toContainText("Connected as");

    // Editing the key clears that answer: a stale "connected" next to a new key
    // would read as if the new key had been checked.
    await page.getByRole("textbox", { name: /New user key/ }).fill("another-key");
    await expect(result).toBeEmpty();
    await expect(page.locator("body")).not.toContainText("keep-this-secret");
  } finally {
    await manager.close();
    await openViking.close();
  }
});

const SAVED = "Configuration saved. The stored user key remains masked.";

test("falls back to the configured account when the data plane reports only a user", async ({ page }) => {
  // OpenViking 0.5.x answers /api/v1/system/status with `result.user` alone.
  // Joining that with an empty account rendered "Connected as /alice".
  const openViking = await startOpenVikingFixture({ statusResult: { user: "alice" } });
  const manager = await startManagerFixture(openViking.url);
  try {
    await page.goto(manager.url);
    await page.getByRole("button", { name: "Verify connection" }).click();
    await expect(page.locator(".ovm-verifyResult")).toHaveText("Connected as personal/alice.");
  } finally {
    await manager.close();
    await openViking.close();
  }
});

test("a background reload that finishes later does not overwrite what the user did", async ({ page }) => {
  // The restart succeeds, but only after the user has already saved — the
  // ordering that used to leave "reloaded" on screen instead of the outcome of
  // the click that actually happened.
  let releaseRestart;
  const restarted = new Promise((resolve) => { releaseRestart = resolve; });
  const openViking = await startOpenVikingFixture();
  const manager = await startManagerFixture(openViking.url, {
    restartMemoryPlugin: async () => {
      await restarted;
      return { restarted: true, count: 1 };
    },
    restartTimeoutMs: 60_000,
    seedPluginDefaults: false,
  });
  try {
    await page.goto(manager.url);
    await expect(page.getByRole("status")).toHaveText("Reloading the official memory plugin…");

    // Saving is a foreground action: its message takes the status line over.
    await page.getByRole("button", { name: "Save configuration" }).click();
    await expect(page.getByRole("status")).toHaveText(SAVED);

    // Now let the background reload finish: the user's message must stay.
    releaseRestart();
    await page.waitForTimeout(500);
    await expect(page.getByRole("status")).toHaveText(SAVED);
  } finally {
    await manager.close();
    await openViking.close();
  }
});

test("verifying answers even while the first-load reload is still running", async ({ page }) => {
  // Slow enough that the in-flight acknowledgement is observable.
  const openViking = await startOpenVikingFixture({ delayMs: 400 });
  // The first-load pass pins the product defaults and reloads the plugin. Here
  // that reload never finishes — it used to leave every control disabled, so
  // clicking Verify did nothing at all.
  const manager = await startManagerFixture(openViking.url, {
    restartMemoryPlugin: () => new Promise(() => {}),
    restartTimeoutMs: 60_000,
    seedPluginDefaults: false,
  });
  try {
    await page.goto(manager.url);
    // The reload is in flight, not finished: this is the window that was dead.
    await expect(page.getByRole("status")).toHaveText("Reloading the official memory plugin…");

    // The button renames itself while in flight, so match either label.
    const verify = page.getByRole("button", { name: /Verify|Verifying/ });
    const result = page.locator(".ovm-verifyResult");
    await expect(verify).toBeEnabled();
    await verify.click();

    // An immediate acknowledgement, then the result — a click always changes
    // the page, even before the probe answers.
    await expect(verify).toHaveText("Verifying…");
    await expect(verify).toHaveAttribute("aria-busy", "true");
    await expect(result).toBeEmpty();
    // The status line is not the answer's home: it still shows the reload that
    // is in flight, which the probe must not displace.
    await expect(page.getByRole("status")).toHaveText("Reloading the official memory plugin…");
    await expect(result).toHaveText("Connected as personal/alice.");
    await expect(page.getByRole("status")).toHaveText("Reloading the official memory plugin…");
    await expect(verify).toHaveText("Verify connection");
    await expect(verify).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("body")).not.toContainText("keep-this-secret");
  } finally {
    await manager.close();
    await openViking.close();
  }
});
