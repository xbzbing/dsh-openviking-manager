import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));
const CJK = /[\u4e00-\u9fff]/;

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("locale files resolve through package exports for readPluginMeta", () => {
  // dsh-app-boot resolves <pkg>/locale/<lang>.json with Node's resolver; a
  // missing exports entry silently disables every locale file.
  assert.match(import.meta.resolve("dsh-openviking-manager/locale/en.json"), /\/locale\/en\.json$/);
  assert.match(import.meta.resolve("dsh-openviking-manager/locale/zh.json"), /\/locale\/zh\.json$/);
});

test("English and Chinese plugin descriptions are separate entries", async () => {
  const manifest = await readJson(join(root, "package.json"));
  const en = await readJson(join(root, "locale/en.json"));
  const zh = await readJson(join(root, "locale/zh.json"));

  assert.ok(manifest.files.includes("locale/*.json"), "locale files must ship in the npm package");
  assert.ok(!manifest.description.includes("|"), "npm description must not concatenate languages");
  assert.equal(manifest.description, en.meta.description, "npm fallback matches the English display text");
  assert.ok(!CJK.test(en.meta.description), "English entry must not contain CJK");
  assert.ok(CJK.test(zh.meta.description), "Chinese entry must contain CJK");

  assert.ok(en.meta.title, "English title must be set");
  assert.ok(zh.meta.title, "Chinese title must be set");
  assert.ok(!CJK.test(en.meta.title), "English title must not contain CJK");
  assert.ok(CJK.test(zh.meta.title), "Chinese title must contain CJK");
});
