import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

test("uses Simplified Chinese when the browser language is Chinese", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "language", { configurable: true, value: "zh-CN" });
    Object.defineProperty(navigator, "languages", { configurable: true, value: ["zh-CN", "zh"] });
  });
  const script = await readFile(`${root}/lib/standalone.js`);
  const server = createServer((req, res) => {
    if (req.url === "/") return res.writeHead(200, { "content-type": "text/html" }).end('<!doctype html><html><body><div id="root"></div><script src="/app.js"></script></body></html>');
    if (req.url === "/app.js") return res.writeHead(200, { "content-type": "application/javascript" }).end(script);
    if (req.url === "/plugins/dsh-openviking-manager/api/discovery") {
      return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true, value: { ovcli: { kind: "missing", config: { url: "http://127.0.0.1:1933", account: "", user: "", apiKeySet: false, apiKeyMasked: "" } }, suggestedEndpoint: "http://127.0.0.1:1933", localServer: { found: false, rootKeyAvailable: false } } }));
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await expect(page.getByRole("heading", { name: "连接你的记忆工作区" })).toBeVisible();
    await expect(page.getByRole("button", { name: "保存配置" })).toBeVisible();
    await page.locator("details.ovm-recovery summary").click();
    await expect(page.getByRole("alert")).toContainText("请先在上方保存 OpenViking 服务地址");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
