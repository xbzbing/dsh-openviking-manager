import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, normalize } from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));

// awesome-dsh-plugin reads this root-level manifest: repository-relative paths,
// 1-8 images, so a plugin can swap screenshots without a PR to the list.
test("screenshots.json lists 1-8 existing repository-relative screenshots", async () => {
  const manifest = JSON.parse(await readFile(join(root, "screenshots.json"), "utf8"));

  assert.ok(Array.isArray(manifest), "manifest must be a JSON array");
  assert.ok(manifest.length >= 1 && manifest.length <= 8, `expected 1-8 entries, got ${manifest.length}`);
  assert.equal(new Set(manifest).size, manifest.length, "entries must be unique");

  for (const entry of manifest) {
    assert.equal(typeof entry, "string");
    assert.ok(!entry.startsWith("/") && !entry.includes(".."), `path must stay inside the repository: ${entry}`);
    assert.match(entry, /\.png$/, `expected a PNG screenshot: ${entry}`);
    await access(join(root, normalize(entry)));
  }
});
