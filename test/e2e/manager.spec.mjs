import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function startManagerFixture({ openVikingUrl = "http://127.0.0.1:8008", sessionToggleGetDelayMs = 0 } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ov-manager-e2e-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: openVikingUrl, api_key: "keep-this-secret", account: "personal", user: "alice" }), "utf8");
  const script = await readFile(join(root, "lib", "standalone.js"));
  const api = await import(join(root, "lib", "manager-api.js"));
  const routes = new Map(api.makeManagerRoutes({ ovcliPath: configPath }).map((route) => [route.path, route.handler]));
  const server = createServer(async (req, res) => {
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
    if (handler) {
      if (url.pathname.endsWith("/session-toggle") && req.method === "GET" && sessionToggleGetDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, sessionToggleGetDelayMs));
      }
      return handler(req, res);
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return {
    url: `http://127.0.0.1:${port}`,
    configPath,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

test("imports existing configuration, keeps a masked key, and saves changed account data", async ({ page }) => {
  const fixture = await startManagerFixture();
  try {
    await page.goto(fixture.url);
    await expect(page.getByRole("heading", { name: "Connect your memory workspace" })).toBeVisible();
    await expect(page.getByLabel("OpenViking endpoint")).toHaveValue("http://127.0.0.1:8008");
    await expect(page.getByLabel("New user key (optional)")).toHaveAttribute("placeholder", /ke…ret/);
    await expect(page.locator("body")).not.toContainText("keep-this-secret");

    await page.getByRole("textbox", { name: "Account", exact: true }).fill("personal-v2");
    await page.getByRole("button", { name: "Save configuration" }).click();
    await expect(page.getByRole("status")).toContainText("Configuration saved");

    const stored = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(stored).toMatchObject({ url: "http://127.0.0.1:8008", account: "personal-v2", user: "alice", api_key: "keep-this-secret" });
  } finally {
    await fixture.close();
  }
});

test("rejects an invalid endpoint without overwriting configuration", async ({ page }) => {
  const fixture = await startManagerFixture();
  try {
    await page.goto(fixture.url);
    await page.getByLabel("OpenViking endpoint").fill("not-a-url");
    await page.getByRole("button", { name: "Save configuration" }).click();
    await expect(page.getByRole("status")).toContainText("absolute http(s) URL");
    const stored = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(stored.url).toBe("http://127.0.0.1:8008");
  } finally {
    await fixture.close();
  }
});

test("keeps recovery access controls collapsed until requested", async ({ page }) => {
  const fixture = await startManagerFixture();
  try {
    await page.goto(fixture.url);
    const recovery = page.locator("details.ovm-recovery");
    await expect(recovery).not.toHaveAttribute("open", "");
    await expect(page.getByLabel("Temporary root API key")).not.toBeVisible();

    await recovery.locator("summary").click();

    await expect(recovery).toHaveAttribute("open", "");
    await expect(page.getByLabel("Temporary root API key")).toBeVisible();
  } finally {
    await fixture.close();
  }
});

test("shows the plugin version and GitHub repository with a manual update check", async ({ page }) => {
  const fixture = await startManagerFixture();
  try {
    await page.goto(fixture.url);
    const about = page.locator("section.ovm-about");
    await expect(about.getByRole("heading", { name: "About this plugin" })).toBeVisible();
    await expect(about).toContainText("Installed version:");
    const repoLink = about.getByRole("link", { name: "https://github.com/xbzbing/dsh-openviking-manager" });
    await expect(repoLink).toHaveAttribute("href", "https://github.com/xbzbing/dsh-openviking-manager");
    // The check is manual: no update status until the button is pressed.
    await expect(about.getByRole("status")).toHaveCount(0);
    await expect(about.getByRole("button", { name: "Check for updates" })).toBeVisible();
  } finally {
    await fixture.close();
  }
});

test("keeps the toggle unavailable while its initial state read is pending", async ({ page }) => {
  const fixture = await startManagerFixture({ sessionToggleGetDelayMs: 250 });
  try {
    await page.goto(fixture.url);
    const toggle = page.getByRole("button", { name: "Toggle OpenViking memory for this session" });
    await expect(toggle).toBeDisabled();
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    await toggle.click();

    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  } finally {
    await fixture.close();
  }
});
