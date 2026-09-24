import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function startTuningFixture({ restartMemoryPlugin, initialConfig, env } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ov-tuning-e2e-"));
  const configPath = join(directory, "ovcli.conf");
  const base = { url: "http://127.0.0.1:8008", api_key: "keep-this-secret", account: "personal", user: "alice" };
  await writeFile(configPath, JSON.stringify({ ...base, ...initialConfig }, null, 2), { encoding: "utf8", mode: 0o600 });
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
    // Destroy idle keep-alive sockets before awaiting close so teardown never
    // waits out the browser connection's idle timeout.
    close: () => new Promise((resolve, reject) => { server.close((error) => (error ? reject(error) : resolve())); server.closeIdleConnections?.(); }),
  };
}

const tuningPanel = (page) => page.locator("details.ovm-tuning");

/** The panel starts collapsed like the recovery one; open it before touching the fields. */
async function expandTuning(page) {
  await tuningPanel(page).locator("summary").click();
}

test("recall tuning writes the official keys and reloads the plugin", async ({ page }) => {
  let restarts = 0;
  const fixture = await startTuningFixture({
    restartMemoryPlugin: async () => { restarts += 1; return { restarted: true, count: 1 }; },
    // Isolation and both product defaults are already pinned, so the only
    // reload here comes from the save itself.
    initialConfig: { plugin: { recallPeerScope: "actor", scoreThreshold: 0.5, recallQueryExpansion: "off" } },
  });
  try {
    await page.goto(fixture.url);
    await expect(page.getByRole("heading", { name: "Recall tuning" })).toBeVisible();
    // The panel is collapsed by default, like "Recover or initialize access".
    await expect(tuningPanel(page)).not.toHaveAttribute("open", "");
    await expandTuning(page);
    // A pinned key loads into its field; an untouched one keeps the empty box
    // with the default it would be initialised to as the placeholder.
    await expect(page.getByLabel("Recall score threshold")).toHaveValue("0.5");
    await expect(page.getByLabel("Recall score threshold")).toHaveAttribute("placeholder", "default: 0.5");
    await expect(page.getByLabel("Maximum injected items")).toHaveAttribute("placeholder", "default: 10");
    await expect(page.getByLabel("Query expansion")).toHaveValue("off");
    await expect(page.getByLabel("Excluded URIs")).toHaveValue("");
    // The card warns up front that saving triggers an automatic reload.
    await expect(page.getByText("Saving these keys reloads the official memory plugin")).toBeVisible();

    await page.getByLabel("Recall score threshold").fill("0.62");
    await page.getByLabel("Maximum injected items").fill("6");
    await page.getByLabel("Query expansion").selectOption("off");
    await page.getByLabel("Excluded URIs").fill("viking://user/xubingzhen/skills\nviking://resources\n");
    await page.getByRole("button", { name: "Save recall tuning" }).click();

    await expect(page.getByRole("status")).toContainText("The official memory plugin reloaded. The new setting is active.");
    await expect.poll(() => restarts).toBe(1);

    const stored = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(stored.plugin.scoreThreshold).toBe(0.62);
    expect(stored.plugin.recallLimit).toBe(6);
    expect(stored.plugin.recallQueryExpansion).toBe("off");
    expect(stored.plugin.recallExcludeUris).toEqual(["viking://user/xubingzhen/skills", "viking://resources"]);
    // The isolation switch and the credentials ride along untouched.
    expect(stored.plugin.recallPeerScope).toBe("actor");
    expect(stored.api_key).toBe("keep-this-secret");
    await expect(page.getByRole("alert").filter({ hasText: "automatic reload did not complete" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Restart official memory plugin" })).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});

test("a fresh config is initialised to the plugin defaults on one reload", async ({ page }) => {
  let restarts = 0;
  const fixture = await startTuningFixture({
    restartMemoryPlugin: async () => { restarts += 1; return { restarted: true, count: 1 }; },
    // Isolation is pinned already, so only the two product defaults are left
    // to write — both in a single write, before a single reload.
    initialConfig: { plugin: { recallPeerScope: "actor" } },
  });
  try {
    await page.goto(fixture.url);
    await expandTuning(page);
    await expect(page.getByLabel("Recall score threshold")).toHaveValue("0.5");
    await expect(page.getByLabel("Query expansion")).toHaveValue("off");
    await expect.poll(() => restarts).toBe(1);
    await expect(page.getByRole("status")).toContainText("The official memory plugin reloaded. The new setting is active.");

    const stored = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(stored.plugin.scoreThreshold).toBe(0.5);
    expect(stored.plugin.recallQueryExpansion).toBe("off");
    // Knobs without a product default stay untouched.
    expect(stored.plugin.recallLimit).toBe(undefined);
    expect(stored.plugin.recallExcludeUris).toBe(undefined);
    expect(stored.api_key).toBe("keep-this-secret");

    // The file now carries the keys, so the next load has nothing to write
    // and no further reload to ask for.
    await page.reload();
    await expect(page.getByLabel("Recall score threshold")).toHaveValue("0.5");
    await expect(page.getByLabel("Query expansion")).toHaveValue("off");
    await expect.poll(() => restarts).toBe(1);
    await expect(page.getByRole("alert").filter({ hasText: "automatic reload did not complete" })).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});

test("warnings stay reachable while the panel is collapsed", async ({ page }) => {
  const fixture = await startTuningFixture({
    // No reload hook: the first-load initialisation writes the product
    // defaults and then cannot apply them.
    initialConfig: { plugin: { recallPeerScope: "actor" } },
  });
  try {
    await page.goto(fixture.url);
    await expect(tuningPanel(page)).not.toHaveAttribute("open", "");
    // The fallback sits outside the fold, so it is there without opening it.
    await expect(page.getByRole("alert").filter({ hasText: "automatic reload did not complete" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Restart official memory plugin" })).toBeVisible();

    const stored = JSON.parse(await readFile(fixture.configPath, "utf8"));
    expect(stored.plugin.scoreThreshold).toBe(0.5);
    expect(stored.plugin.recallQueryExpansion).toBe("off");
  } finally {
    await fixture.close();
  }
});

test("clearing a field restores that knob's default: the product one, or the official one", async ({ page }) => {
  let restarts = 0;
  const fixture = await startTuningFixture({
    restartMemoryPlugin: async () => { restarts += 1; return { restarted: true, count: 1 }; },
    initialConfig: {
      plugin: {
        recallPeerScope: "actor",
        scoreThreshold: 0.62,
        recallLimit: 6,
        recallQueryExpansion: "off",
        recallExcludeUris: ["viking://user/xubingzhen/skills"],
      },
    },
  });
  try {
    await page.goto(fixture.url);
    await expandTuning(page);
    // A configured key loads into its field instead of the placeholder.
    await expect(page.getByLabel("Recall score threshold")).toHaveValue("0.62");
    await expect(page.getByLabel("Maximum injected items")).toHaveValue("6");
    await expect(page.getByLabel("Query expansion")).toHaveValue("off");
    await expect(page.getByLabel("Excluded URIs")).toHaveValue("viking://user/xubingzhen/skills");

    await page.getByLabel("Recall score threshold").fill("");
    await page.getByLabel("Maximum injected items").fill("");
    await page.getByLabel("Query expansion").selectOption("auto");
    await page.getByLabel("Excluded URIs").fill("");
    await page.getByRole("button", { name: "Save recall tuning" }).click();

    await expect(page.getByRole("status")).toContainText("The official memory plugin reloaded. The new setting is active.");
    await expect.poll(() => restarts).toBe(1);

    const stored = JSON.parse(await readFile(fixture.configPath, "utf8"));
    // The pinned knob comes back as the product default rather than absent —
    // otherwise the next load would write it right back.
    expect(stored.plugin.scoreThreshold).toBe(0.5);
    // "Automatic" is an explicit choice and is written, so it survives a reload.
    expect(stored.plugin.recallQueryExpansion).toBe("auto");
    // Knobs without a product default fall back to the official one: no key.
    expect(stored.plugin.recallLimit).toBe(undefined);
    expect(stored.plugin.recallExcludeUris).toBe(undefined);
    expect(stored.plugin.recallPeerScope).toBe("actor");
    await expect(page.getByLabel("Recall score threshold")).toHaveValue("0.5");
  } finally {
    await fixture.close();
  }
});

test("an env-configured knob is read-only and warns about the override", async ({ page }) => {
  const fixture = await startTuningFixture({
    restartMemoryPlugin: async () => ({ restarted: true, count: 1 }),
    initialConfig: { plugin: { recallPeerScope: "actor" } },
    env: { OPENVIKING_SCORE_THRESHOLD: "0.9" },
  });
  try {
    await page.goto(fixture.url);
    await expandTuning(page);
    const threshold = page.getByLabel("Recall score threshold");
    await expect(threshold).toHaveValue("0.9");
    expect(await threshold.isDisabled()).toBe(true);
    await expect(page.getByRole("alert").filter({ hasText: "OPENVIKING_SCORE_THRESHOLD" })).toBeVisible();
    // Only the overridden field locks; the rest of the form stays editable,
    // and the pinned expansion is initialised as usual.
    expect(await page.getByLabel("Maximum injected items").isEnabled()).toBe(true);
    await expect(page.getByLabel("Query expansion")).toHaveValue("off");
  } finally {
    await fixture.close();
  }
});

test("renders the recall tuning section in Simplified Chinese", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "language", { configurable: true, value: "zh-CN" });
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["zh-CN", "zh"] });
  });
  const fixture = await startTuningFixture({
    restartMemoryPlugin: async () => ({ restarted: true, count: 1 }),
    initialConfig: { plugin: { recallPeerScope: "actor" } },
  });
  try {
    await page.goto(fixture.url);
    await expect(page.getByRole("heading", { name: "召回调优" })).toBeVisible();
    await expect(tuningPanel(page)).not.toHaveAttribute("open", "");
    await expandTuning(page);
    await expect(page.getByLabel("召回分数阈值")).toHaveAttribute("placeholder", "默认：0.5");
    await expect(page.getByLabel("单次注入条数上限")).toHaveAttribute("placeholder", "默认：10");
    await expect(page.getByLabel("召回分数阈值")).toHaveValue("0.5");
    await expect(page.getByLabel("排除的 URI")).toBeVisible();
    await expect(page.getByRole("button", { name: "保存召回调优" })).toBeVisible();
    await expect(page.getByText("保存这些键同样会自动重新加载官方记忆插件")).toBeVisible();
  } finally {
    await fixture.close();
  }
});
