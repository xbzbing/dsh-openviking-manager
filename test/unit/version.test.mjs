import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkLatestVersion, compareVersions, readVersionInfo } from "../../lib/version.js";

async function withManifest(t, manifest) {
  const directory = await mkdtemp(join(tmpdir(), "dsh-ovm-version-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "package.json");
  await writeFile(path, JSON.stringify(manifest), "utf8");
  return path;
}

test("compareVersions orders dotted numeric versions", () => {
  assert.equal(compareVersions("0.3.0", "0.2.0"), 1);
  assert.equal(compareVersions("0.2.0", "0.3.0"), -1);
  assert.equal(compareVersions("v0.2.0", "0.2.0"), 0);
  assert.equal(compareVersions("1.0.0", "0.9.9"), 1);
  assert.equal(compareVersions("0.2.0", "0.2.0-beta.1"), 1);
});

test("readVersionInfo derives the repository URL without network access", async (t) => {
  const path = await withManifest(t, {
    version: "0.2.0",
    repository: { type: "git", url: "git+https://github.com/xbzbing/dsh-openviking-manager.git" },
  });
  const info = await readVersionInfo({ manifestPath: path });
  assert.equal(info.current, "0.2.0");
  assert.equal(info.repositoryUrl, "https://github.com/xbzbing/dsh-openviking-manager");
  assert.equal(info.checkedRemote, false);
  assert.equal(info.updateAvailable, false);
});

test("readVersionInfo accepts a shorthand owner/repo repository string", async (t) => {
  const path = await withManifest(t, { version: "1.0.0", repository: "github:foo/bar" });
  const info = await readVersionInfo({ manifestPath: path });
  assert.equal(info.repositoryUrl, "https://github.com/foo/bar");
});

test("checkLatestVersion flags a newer release", async (t) => {
  const path = await withManifest(t, {
    version: "0.2.0",
    repository: "https://github.com/xbzbing/dsh-openviking-manager",
  });
  let requested;
  const fetchFn = async (url) => {
    requested = String(url);
    return new Response(JSON.stringify({ tag_name: "v0.3.0", html_url: "https://github.com/xbzbing/dsh-openviking-manager/releases/tag/v0.3.0" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const result = await checkLatestVersion({ manifestPath: path, fetchFn });
  assert.match(requested, /api\.github\.com\/repos\/xbzbing\/dsh-openviking-manager\/releases\/latest/);
  assert.equal(result.checkedRemote, true);
  assert.equal(result.latest, "0.3.0");
  assert.equal(result.updateAvailable, true);
  assert.equal(result.releaseUrl, "https://github.com/xbzbing/dsh-openviking-manager/releases/tag/v0.3.0");
  assert.equal(result.error, undefined);
});

test("checkLatestVersion reports up-to-date when the release matches", async (t) => {
  const path = await withManifest(t, { version: "0.3.0", repository: "https://github.com/foo/bar" });
  const fetchFn = async () => new Response(JSON.stringify({ tag_name: "v0.3.0" }), { status: 200 });
  const result = await checkLatestVersion({ manifestPath: path, fetchFn });
  assert.equal(result.updateAvailable, false);
  assert.equal(result.latest, "0.3.0");
});

test("checkLatestVersion surfaces a GitHub error status without throwing", async (t) => {
  const path = await withManifest(t, { version: "0.2.0", repository: "https://github.com/foo/bar" });
  const fetchFn = async () => new Response("", { status: 404 });
  const result = await checkLatestVersion({ manifestPath: path, fetchFn });
  assert.equal(result.checkedRemote, true);
  assert.equal(result.updateAvailable, false);
  assert.match(result.error, /404/);
});

test("checkLatestVersion surfaces a network failure without throwing", async (t) => {
  const path = await withManifest(t, { version: "0.2.0", repository: "https://github.com/foo/bar" });
  const fetchFn = async () => { throw new Error("network down"); };
  const result = await checkLatestVersion({ manifestPath: path, fetchFn });
  assert.equal(result.error, "network down");
});

test("checkLatestVersion reports a missing repository configuration", async (t) => {
  const path = await withManifest(t, { version: "0.2.0" });
  const result = await checkLatestVersion({ manifestPath: path, fetchFn: async () => new Response("{}") });
  assert.equal(result.checkedRemote, false);
  assert.match(result.error, /repository is not configured/);
});
