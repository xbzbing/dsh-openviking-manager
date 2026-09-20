#!/usr/bin/env node
/**
 * Regenerates the README screenshots from a real DSH instance.
 *
 * Clones the user's profile into a throwaway DSH_HOME and starts an isolated
 * `dsh` there, so the images show the plugin inside the actual DSH web shell
 * instead of a bare fixture page. The clone also lets the run point HOME at a
 * sandbox, which keeps the developer's own ~/.openviking/ovcli.conf out of the
 * committed images.
 *
 * Run `npm run build` first; `npm run screenshots` does both.
 *
 * Env overrides: DSH_PROFILE (default "web"), OVM_SHOT_PORT (default 3199).
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = join(root, "docs", "assets", "screenshots");
const profile = process.env.DSH_PROFILE ?? "web";
const port = Number(process.env.OVM_SHOT_PORT ?? 3199);
const viewport = { width: 1120, height: 1290 };
const USER_KEY = "ov_user_demo_key_9f3c1a";
const ROOT_KEY = "root-demo-key";

const labels = {
  zh: { nav: "插件", installed: "已安装", plugin: "openviking-manager", verify: "验证连接", rootKey: "临时 root API key", listAccounts: "列出账号", account: "已有账号", tabUser: "创建用户" },
  en: { nav: "Plugins", installed: "Installed", plugin: "openviking-manager", verify: "Verify connection", rootKey: "Temporary root API key", listAccounts: "List accounts", account: "Existing account", tabUser: "Create user" },
};

/** Stub OpenViking on its default port so the endpoint in the images is stable. */
async function startOpenViking() {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
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
  await new Promise((resolve, reject) => {
    server.once("error", (error) => (error.code !== "EADDRINUSE" ? reject(error) : server.listen(0, "127.0.0.1", resolve)));
    server.listen(1933, "127.0.0.1", resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

/** Clones the profile and points HOME at the sandbox so no personal config leaks in. */
async function prepareHome(home) {
  await mkdir(join(home, "profiles"), { recursive: true });
  await cp(join(homedir(), ".dsh", "profiles", profile), join(home, "profiles", profile), { recursive: true, verbatimSymlinks: true });
  for (const file of ["settings.yaml", "dush-settings.yaml", ".credentials.yaml", "dush-credentials.yaml"]) {
    await cp(join(homedir(), ".dsh", file), join(home, file)).catch(() => {});
  }
  await mkdir(join(home, ".openviking"), { recursive: true });
  await writeFile(join(home, ".openviking", "ovcli.conf"), `${JSON.stringify({ url: "http://127.0.0.1:1933", api_key: USER_KEY, account: "personal", user: "alice" }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

/** Switches the DSH interface language, which the plugin follows via ctx.locale. */
async function setLocale(home, preference) {
  for (const file of ["settings.yaml", "dush-settings.yaml"]) {
    const path = join(home, file);
    const text = await readFile(path, "utf8").catch(() => "");
    if (text === "") continue;
    await writeFile(path, text.replace(/(\nlocale:\n\s+preference:\s*)\w+/, `$1${preference}`), "utf8");
  }
}

async function startDsh(home, locale) {
  await setLocale(home, locale);
  const child = spawn("dsh", [`--profile`, profile, "--port", String(port), "--no-open"], {
    env: { ...process.env, HOME: home, DSH_HOME: home },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`dsh did not print an auth URL in time:\n${output}`)), 90_000);
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[\w-]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`dsh exited early (code ${code}):\n${output}`));
    });
  });
  return { url, stop: () => new Promise((resolve) => { child.once("exit", resolve); child.kill("SIGTERM"); }) };
}

async function shoot(page, locale, name) {
  const directory = join(outputRoot, locale);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${name}.png`) });
  console.log(`  ${locale}/${name}.png`);
}

/** Scrolls the plugin card to a stable offset so the recovery section fits on screen. */
async function revealRecovery(page) {
  await page.evaluate(() => {
    const scroller = [...document.querySelectorAll("section")].find((element) => element.scrollHeight > element.clientHeight + 5);
    const recovery = document.querySelector("details.ovm-recovery");
    if (!scroller || !recovery) return;
    scroller.scrollTop += recovery.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 300;
  });
  await page.waitForTimeout(400);
}

async function capture(page, locale, url) {
  const text = labels[locale];
  await page.goto(url);
  await page.waitForTimeout(4000);
  const dismiss = page.getByRole("button", { name: /稍后|Later/ });
  if (await dismiss.count()) await dismiss.first().click().catch(() => {});
  await page.waitForTimeout(400);

  // 1. The plugin inside the DSH plugin manager, alongside the other installed plugins.
  await page.getByRole("button", { name: text.nav }).first().click();
  await page.waitForTimeout(2000);
  await page.getByText(text.installed, { exact: true }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shoot(page, locale, "01-plugin-list");

  // 2. The plugin's own page: connection form, masked key, verified status.
  await page.getByText(text.plugin, { exact: true }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: text.verify }).click();
  await page.waitForTimeout(1200);
  await shoot(page, locale, "02-configuration");

  // 3. Recovery section on its default tab, after loading accounts and users.
  await page.locator("details.ovm-recovery summary").click();
  await page.getByLabel(text.rootKey).fill(ROOT_KEY);
  await page.getByRole("button", { name: text.listAccounts }).click();
  await page.waitForTimeout(900);
  await page.getByLabel(text.account).selectOption("personal");
  await page.waitForTimeout(900);
  await revealRecovery(page);
  await shoot(page, locale, "03-recovery-accounts");

  // 4. The add-user tab, which picks from the listed accounts.
  await page.getByRole("tab", { name: text.tabUser }).click();
  await page.waitForTimeout(600);
  await revealRecovery(page);
  await shoot(page, locale, "04-create-user");
}

const home = await mkdtemp(join(tmpdir(), "dsh-ovm-shots-"));
const openViking = await startOpenViking();
const browser = await chromium.launch();
let dsh;
try {
  await prepareHome(home);
  for (const locale of ["zh", "en"]) {
    dsh = await startDsh(home, locale);
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await capture(page, locale, dsh.url);
    await context.close();
    await dsh.stop();
    dsh = undefined;
  }
} finally {
  if (dsh) await dsh.stop().catch(() => {});
  await browser.close();
  await openViking.close();
  await rm(home, { recursive: true, force: true });
}
console.log(`wrote screenshots to ${outputRoot}`);
