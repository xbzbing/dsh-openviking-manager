import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve, dirname } from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));

test("package icon satisfies the DSH iconOf contract", async () => {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.equal(manifest.icon, "./icon.svg", "icon must be a manifest-relative path");
  assert.ok(manifest.files.includes("icon.svg"), "icon must ship in the npm package");

  const iconPath = resolve(dirname(join(root, "package.json")), manifest.icon);
  const bytes = await readFile(iconPath);
  assert.ok(bytes.length > 0, "icon file must not be empty");
  assert.ok(bytes.length <= 256 * 1024, "icon must be at most 256 KiB");

  const svg = bytes.toString("utf8");
  assert.match(svg, /^<svg\b/, "icon must be an SVG document");
  assert.doesNotMatch(svg, /<script\b/i, "icon must not contain scripts");
  assert.match(svg, /viewBox="0 0 36 36"/, "icon must use the 36x36 plugin artwork box");
});
