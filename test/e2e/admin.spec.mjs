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

async function startManagerFixture(openVikingUrl, { writeConfig = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ov-manager-e2e-admin-"));
  const configPath = join(directory, "ovcli.conf");
  if (writeConfig) {
    await writeFile(configPath, JSON.stringify({ url: openVikingUrl, api_key: "keep-this-secret", account: "personal", user: "alice" }), "utf8");
  }
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

test("lays out the recovery toggle inline with its heading", async ({ page }) => {
  const openViking = await startOpenVikingFixture();
  const manager = await startManagerFixture(openViking.url);
  try {
    await page.goto(manager.url);
    const summary = page.locator("details.ovm-recovery > summary");
    await expect(summary).toHaveCSS("display", "flex");
    await expect(summary).toHaveCSS("align-items", "center");

    const marker = await summary.evaluate((element) => {
      const style = getComputedStyle(element, "::after");
      return { float: style.float, borderTopWidth: style.borderTopWidth, width: style.width };
    });
    expect(marker.float).toBe("none");
    expect(marker.borderTopWidth).toBe("1px");
    expect(marker.width).toBe("24px");

    const heading = await page.locator("details.ovm-recovery > summary > h2").boundingBox();
    const toggle = await summary.boundingBox();
    expect(Math.abs((heading.y + heading.height / 2) - (toggle.y + toggle.height / 2))).toBeLessThan(3);
  } finally {
    await manager.close();
    await openViking.close();
  }
});

test("distinguishes creating an account from adding a user", async ({ page }) => {
  const openViking = await startOpenVikingFixture();
  const manager = await startManagerFixture(openViking.url);
  try {
    await page.goto(manager.url);
    await page.locator("details.ovm-recovery summary").click();

    const createAccount = page.locator("#ovm-panel-create-account");
    const createUser = page.locator("#ovm-panel-create-user");
    await expect(createAccount.getByText("Creates a new account together with its first admin user.")).toBeVisible();
    expect(await createAccount.getByLabel("Account ID").evaluate((element) => element.tagName)).toBe("INPUT");

    await page.getByRole("tab", { name: "Create user" }).click();
    await expect(createUser.getByText("Adds a user to an account that already exists.")).toBeVisible();
    await expect(createUser.getByText(/List accounts first/)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Create user" })).toHaveAttribute("aria-selected", "true");
    expect(await createUser.getByRole("button", { name: "Create user" }).isDisabled()).toBe(true);
  } finally {
    await manager.close();
    await openViking.close();
  }
});

test("lists existing accounts and users using one temporary root key", async ({ page }) => {
  const openViking = await startOpenVikingFixture();
  const manager = await startManagerFixture(openViking.url);
  try {
    await page.goto(manager.url);
    await page.locator("details.ovm-recovery summary").click();
    await expect(page.getByRole("tablist")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Create account" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Create account and first user" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create user in current account" })).not.toBeVisible();
    await page.getByRole("tab", { name: "Create user" }).click();
    await expect(page.getByRole("tab", { name: "Create user" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Create user in current account" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Create account and first user" })).not.toBeVisible();
    await page.getByLabel("Temporary root API key").fill("root-for-test");
    await page.getByRole("button", { name: "List accounts" }).click();
    await expect(page.getByText(/Found 2 account/)).toBeVisible();
    await page.getByLabel("Existing account").selectOption("personal");
    await expect(page.getByText(/Found 2 user\(s\) in personal/)).toBeVisible();
    await expect(page.getByLabel("Existing user")).toHaveValue("alice");
    await expect(page.locator("body")).not.toContainText("root-for-test");

    // Once accounts are listed, adding a user picks from them instead of typing one.
    await page.getByRole("tab", { name: "Create user" }).click();
    const createUser = page.locator("#ovm-panel-create-user");
    const accountField = createUser.getByLabel("Account ID");
    expect(await accountField.evaluate((element) => element.tagName)).toBe("SELECT");
    await expect(accountField.locator("option")).toHaveCount(3);
    await expect(accountField).toHaveValue("personal");
    await expect(createUser.getByRole("button", { name: "Create user" })).toBeEnabled();
  } finally {
    await manager.close();
    await openViking.close();
  }
});

test("asks to save the endpoint before recovery tools when no config is saved", async ({ page }) => {
  const openViking = await startOpenVikingFixture();
  const manager = await startManagerFixture(openViking.url, { writeConfig: false });
  try {
    await page.goto(manager.url);
    await page.locator("details.ovm-recovery summary").click();
    await expect(page.getByRole("alert")).toContainText("Save the OpenViking endpoint above first");

    await page.getByLabel("Temporary root API key").fill("root-for-test");
    await page.getByRole("button", { name: "List accounts" }).click();

    await expect(page.getByRole("alert")).toContainText("Save the OpenViking endpoint above first");
    await expect(page.locator("body")).not.toContainText("url must be a non-empty string");
  } finally {
    await manager.close();
    await openViking.close();
  }
});

test("unlocks recovery tools once the endpoint is saved", async ({ page }) => {
  const openViking = await startOpenVikingFixture();
  const manager = await startManagerFixture(openViking.url, { writeConfig: false });
  try {
    await page.goto(manager.url);
    await page.locator("details.ovm-recovery summary").click();
    await expect(page.getByRole("alert")).toBeVisible();

    await page.getByLabel("OpenViking endpoint").fill(openViking.url);
    await page.getByRole("textbox", { name: "Account", exact: true }).fill("personal");
    await page.getByRole("textbox", { name: "User", exact: true }).fill("alice");
    await page.getByRole("button", { name: "Save configuration" }).click();
    await expect(page.getByRole("status").first()).toContainText("Configuration saved");
    await expect(page.getByRole("alert")).not.toBeVisible();

    await page.getByLabel("Temporary root API key").fill("root-for-test");
    await page.getByRole("button", { name: "List accounts" }).click();
    await expect(page.getByText(/Found 2 account/)).toBeVisible();
  } finally {
    await manager.close();
    await openViking.close();
  }
});
