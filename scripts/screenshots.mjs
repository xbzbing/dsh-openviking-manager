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
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
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
  await installLocalPlugin(join(home, "profiles", profile));
}

/**
 * Replaces the cloned profile's installed package with this repository's
 * build, so the images always show the checked-out code rather than whatever
 * version happened to be installed into the live profile last.
 */
async function installLocalPlugin(target) {
  const skip = new Set(["node_modules", ".git", "test", "test-results", "playwright-report", "docs", "scripts", "ms-playwright", ".dsh-vision-router", ".dsh-vision-hooks"]);
  const destination = join(target, "node_modules", "dsh-openviking-manager");
  await rm(destination, { recursive: true, force: true });
  await cp(root, destination, {
    recursive: true,
    filter: (source) => {
      const rel = relative(root, source);
      if (rel === "") return true;
      const [head] = rel.split("/");
      if (skip.has(head)) return false;
      if (rel === "lib/standalone.js") return false;
      if (head.startsWith(".env")) return false;
      return true;
    },
  });
}

/** Switches the DSH interface language, which the plugin follows via ctx.locale. */
async function setLocale(home, preference) {
  // The active store is the profile's cordis patch (the legacy settings.yaml
  // was migrated into it); the home-level files are kept as extra targets for
  // older layouts, where they were the document.
  const patch = join(home, "profiles", profile, "cordis.patch.yml");
  const patchText = await readFile(patch, "utf8").catch(() => "");
  if (patchText !== "") {
    const scoped = /(- id: locale\n(?:(?!- id:)[\s\S])*?    preference: )\w+/;
    // Test before replacing: writing the same value (zh → zh) is a legitimate
    // no-op and must not be mistaken for a missing entry.
    if (!scoped.test(patchText)) throw new Error(`unable to switch locale in ${patch}: no locale preference entry`);
    await writeFile(patch, patchText.replace(scoped, `$1${preference}`), "utf8");
  }
  for (const file of [join(home, "settings.yaml"), join(home, "dush-settings.yaml")]) {
    const text = await readFile(file, "utf8").catch(() => "");
    if (text === "") continue;
    await writeFile(file, text.replace(/(\nlocale:\n\s+preference:\s*)\w+/, `$1${preference}`), "utf8");
  }
}

/**
 * Drops everything a previous run created at home level (storages, sessions,
 * caches, the default workspace with its locale-frozen title) so the next
 * locale boots fresh. The prepared inputs are kept.
 */
const PREPARED_HOME_ENTRIES = new Set([
  "profiles", ".openviking", "settings.yaml", "dush-settings.yaml", ".credentials.yaml", "dush-credentials.yaml",
]);
async function resetRuntimeState(home) {
  for (const entry of await readdir(home)) {
    if (PREPARED_HOME_ENTRIES.has(entry)) continue;
    await rm(join(home, entry), { recursive: true, force: true });
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
  // The plugin list renders the localized meta title, not the package name.
  const meta = JSON.parse(await readFile(join(root, "locale", `${locale}.json`), "utf8"));
  const pluginTitle = meta?.meta?.title || text.plugin;
  await page.goto(url);
  await page.waitForTimeout(4000);
  const dismiss = page.getByRole("button", { name: /稍后|Later/ });
  if (await dismiss.count()) await dismiss.first().click().catch(() => {});
  await page.waitForTimeout(400);

  // 1. The plugin inside the DSH plugin manager, alongside the other installed plugins.
  // Fail loudly if the interface came up in the wrong language: silently
  // shooting both locales in one language would publish broken README images.
  const { lang } = await page.evaluate(() => ({ lang: document.documentElement.lang }));
  const expected = locale === "zh" ? "zh" : "en";
  if (!lang.toLowerCase().startsWith(expected)) {
    throw new Error(`interface locale mismatch: expected ${expected}, page reports "${lang}"`);
  }
  await page.getByRole("button", { name: text.nav }).first().click();
  await page.waitForTimeout(2000);
  await page.getByText(text.installed, { exact: true }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await shoot(page, locale, "01-plugin-list");

  // 2. The plugin's own page: connection form, masked key, verified status.
  await page.getByText(pluginTitle, { exact: true }).first().click();
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
    // Runtime state (storages, default-workspace titles) was created under the
    // previous locale; the next language must boot from a clean slate.
    await resetRuntimeState(home);
  }
} finally {
  if (dsh) await dsh.stop().catch(() => {});
  await browser.close();
  await openViking.close();
  await rm(home, { recursive: true, force: true });
}
console.log(`wrote screenshots to ${outputRoot}`);
