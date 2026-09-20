#!/usr/bin/env node
/**
 * Regenerates the README screenshots for both supported locales.
 *
 * Runs the real manager routes from lib/ against a stub OpenViking server, so
 * every image shows the shipped UI rather than a mock-up. Run `npm run build`
 * first; `npm run screenshots` does both.
 */
import { createServer } from "node:http";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(root, "docs", "assets", "screenshots");
const USER_KEY = "user-demo-key";
const ROOT_KEY = "root-demo-key";

const labels = {
  zh: { verify: "验证连接", connected: /已连接为/, rootKey: "临时 root API key", listAccounts: "列出账号", account: "已有账号", user: "已有用户", tabAccount: "创建账号", tabUser: "创建用户" },
  en: { verify: "Verify connection", connected: /Connected as/, rootKey: "Temporary root API key", listAccounts: "List accounts", account: "Existing account", user: "Existing user", tabAccount: "Create account", tabUser: "Create user" },
};

async function startOpenViking() {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    // The data plane authenticates with a bearer user key; the Admin API uses X-API-Key.
    const userKey = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    const rootKey = req.headers["x-api-key"];
    const reply = (status, body) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    if (path === "/health") return reply(200, { status: "ok" });
    if (path === "/ready") return reply(200, { status: "ready" });
    if (path === "/api/v1/system/status" && userKey === USER_KEY) return reply(200, { result: { account: "personal", user: "alice" } });
    if (path === "/api/v1/admin/accounts" && rootKey === ROOT_KEY) return reply(200, { result: [{ account_id: "personal" }, { account_id: "archive" }] });
    if (path === "/api/v1/admin/accounts/personal/users" && rootKey === ROOT_KEY) return reply(200, { result: [{ user_id: "alice", role: "admin" }, { user_id: "bob", role: "user" }] });
    return reply(401, { error: "unauthorized" });
  });
  // Prefer OpenViking's default port so the endpoint shown in the images stays
  // stable across runs; fall back to an ephemeral port when it is taken.
  await new Promise((resolve, reject) => {
    server.once("error", (error) => {
      if (error.code !== "EADDRINUSE") return reject(error);
      server.listen(0, "127.0.0.1", resolve);
    });
    server.listen(1933, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

/** Starts a manager host serving lib/standalone.js plus the real manager routes. */
async function startManager(openVikingUrl, configMode) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-shots-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, `${JSON.stringify({ url: openVikingUrl, api_key: USER_KEY, account: "personal", user: "alice" }, null, 2)}\n`, "utf8");
  await chmod(configPath, configMode);
  const script = await readFile(join(root, "lib", "standalone.js"));
  const api = await import(join(root, "lib", "manager-api.js"));
  const routes = new Map(api.makeManagerRoutes({ ovcliPath: configPath }).map((route) => [route.path, route.handler]));
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    if (path === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end('<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>');
      return;
    }
    if (path === "/app.js") {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end(script);
      return;
    }
    const handler = routes.get(path);
    if (handler) return handler(req, res);
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

async function shoot(page, target, locale, name) {
  const directory = join(outputRoot, locale);
  await mkdir(directory, { recursive: true });
  await page.locator(target).screenshot({ path: join(directory, `${name}.png`) });
  console.log(`  ${locale}/${name}.png`);
}

async function capture(page, locale, managerUrl) {
  const text = labels[locale];
  await page.goto(managerUrl);
  await page.getByRole("button", { name: text.verify }).waitFor();

  // Configuration form, with the stored user key shown only as a mask.
  await shoot(page, ".ovm-shell > .ovm-card:first-of-type", locale, "01-configuration");

  // Successful verification, including the local ov.conf discovery line.
  await page.getByRole("button", { name: text.verify }).click();
  await page.getByText(text.connected).waitFor();
  await shoot(page, ".ovm-shell > .ovm-card:first-of-type", locale, "02-connection");

  // Recovery section on its default tab, after loading accounts and users.
  await page.locator("details.ovm-recovery summary").click();
  await page.getByLabel(text.rootKey).fill(ROOT_KEY);
  await page.getByRole("button", { name: text.listAccounts }).click();
  await page.getByLabel(text.account).selectOption("personal");
  await page.getByLabel(text.user).waitFor();
  await shoot(page, "details.ovm-recovery", locale, "03-recovery-accounts");

  // The remaining recovery tabs, each with its own job.
  await page.getByRole("tab", { name: text.tabAccount }).click();
  await shoot(page, "#ovm-panel-create-account", locale, "04-create-account");
  await page.getByRole("tab", { name: text.tabUser }).click();
  await shoot(page, "#ovm-panel-create-user", locale, "05-create-user");
}

const openViking = await startOpenViking();
const browser = await chromium.launch();
try {
  for (const locale of ["zh", "en"]) {
    const context = await browser.newContext({ viewport: { width: 800, height: 1100 }, deviceScaleFactor: 2 });
    await context.addInitScript((value) => {
      Object.defineProperty(navigator, "language", { configurable: true, value });
      Object.defineProperty(navigator, "languages", { configurable: true, value: [value] });
    }, locale === "zh" ? "zh-CN" : "en-US");
    const page = await context.newPage();

    const manager = await startManager(openViking.url, 0o600);
    await capture(page, locale, manager.url);
    await manager.close();

    // An ovcli.conf readable by other users surfaces the permission repair action.
    const unsafe = await startManager(openViking.url, 0o644);
    await page.goto(unsafe.url);
    await page.locator(".ovm-warning").waitFor();
    await shoot(page, ".ovm-shell > .ovm-card:first-of-type", locale, "06-permissions");
    await unsafe.close();

    await context.close();
  }
} finally {
  await browser.close();
  await openViking.close();
}
console.log(`wrote screenshots to ${outputRoot}`);
