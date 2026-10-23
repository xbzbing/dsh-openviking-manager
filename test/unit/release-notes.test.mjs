/**
 * Release notes are a contract, not free prose. A stable release ships its body
 * in `docs/releases/<tag>.md`, written from `.github/RELEASE_TEMPLATE.md` and
 * read by the release workflow instead of retyped at publish time; a pre-release
 * ships the fixed notice in `.github/PRERELEASE_BODY.md` and keeps no change log
 * at all. This test keeps those files honest — a stable body missing the English
 * half, the verification section or the compare link, a pre-release file that
 * crept into `docs/releases/`, or a notice that records changes, is caught here
 * rather than on the release page.
 *
 * The distribution rule this guards hardest is the one that breaks installs
 * silently: `lib/` is not committed, so a `github:` install (or a hint of one in
 * the notes) hands the user a tree without a build output and the plugin never
 * loads. Every install command must therefore be an npm version or a Release
 * asset URL.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../../", import.meta.url);
const TEMPLATE = fileURLToPath(new URL(".github/RELEASE_TEMPLATE.md", ROOT));
const NOTICE = fileURLToPath(new URL(".github/PRERELEASE_BODY.md", ROOT));
const NOTES_DIR = fileURLToPath(new URL("docs/releases/", ROOT));
const PACKAGE = JSON.parse(readFileSync(fileURLToPath(new URL("package.json", ROOT)), "utf8"));

/** Headings every stable body must carry, in both languages. */
const REQUIRED_HEADINGS = ["## 主要变更", "## 安装", "## 验证", "## English", "## Install", "## Verification"];

/** The compare link that closes each language half, with real tags. */
const COMPARE_LINK =
  /https:\/\/github\.com\/xbzbing\/dsh-openviking-manager\/compare\/v\d+\.\d+\.\d+[^\s]*\.\.\.v\d+\.\d+\.\d+/g;

/** `docs/releases/` records stable versions only — no `-prerelease` suffix. */
const NOTES_FILE = /^v\d+\.\d+\.\d+\.md$/;

/** A version carrying `-` is a pre-release: GitHub only, npm never, and its
 * change log is authored on the page rather than archived. */
const PRERELEASE_VERSION = /-/;

/** `dsh plugin --profile web add dsh-openviking-manager@1.2.3` */
const NPM_INSTALL = /dsh plugin --profile web add dsh-openviking-manager@\d+\.\d+\.\d+/;

/** A GitHub Release asset URL for this package. */
const ASSET_INSTALL =
  /releases\/download\/(v\d+\.\d+\.\d+[^\s/]*)\/dsh-openviking-manager-\d+\.\d+\.\d+[^\s/]*\.tgz/g;

/** Every install command a page tells the reader to run. The prose around them
 * may freely name the forms that do *not* work — that is how a reader learns
 * why the repository URL was dropped — so the rules below are applied to the
 * commands themselves, never to the sentence explaining them. */
function installCommands(body) {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^dsh plugin\b/.test(line));
}

/** `docs/releases/` archives stable versions only, so the directory may be
 * legitimately empty between releases — an absent one is no bodies, not a
 * failure. */
function readNotes() {
  if (!existsSync(NOTES_DIR)) return [];
  return readdirSync(NOTES_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ file, body: readFileSync(NOTES_DIR + file, "utf8") }));
}

test("the release template carries the shape the notes are validated against", () => {
  assert.ok(existsSync(TEMPLATE), ".github/RELEASE_TEMPLATE.md is the format source");
  const template = readFileSync(TEMPLATE, "utf8");
  for (const heading of REQUIRED_HEADINGS) {
    assert.ok(template.includes(heading), `the template must show ${heading}`);
  }
  assert.match(template, /compare\/<PREV>\.\.\.<TAG>/, "the template must show the compare link");
  assert.match(template, /dsh-openviking-manager@<VERSION>/, "the template must show the npm install");
  assert.match(template, /releases\/download\/<TAG>\//, "the template must show the asset install");
  // The template must send pre-releases to the fixed notice instead of a body.
  assert.match(template, /PRERELEASE_BODY\.md/);
  // …and it must warn against the install form that cannot work.
  assert.match(template, /不要写 `github:` 安装/);
});

test("the pre-release notice stays a notice: bilingual, placeholders intact, no npm", () => {
  const notice = readFileSync(NOTICE, "utf8");
  assert.match(notice, /## 预发布/);
  assert.match(notice, /## Pre-release/);
  assert.match(notice, /<TAG>/);
  assert.match(notice, /<VERSION>/);
  assert.match(notice, /releases\/download\/<TAG>\//);
  assert.doesNotMatch(notice, NPM_INSTALL, "a pre-release is never published to npm");
  assert.doesNotMatch(notice, /^## 主要变更/m, "the notice records no changes");
});

test("every stable body is bilingual, complete and closes with the compare link", () => {
  for (const { file, body } of readNotes()) {
    assert.match(file, NOTES_FILE, `${file}: docs/releases/ holds stable versions only`);
    for (const heading of REQUIRED_HEADINGS) {
      assert.ok(body.includes(heading), `${file}: missing ${heading}`);
    }
    // One link per language half, both pointing at a real previous tag.
    assert.equal(body.match(COMPARE_LINK)?.length, 2, `${file}: each half ends with the compare link`);
    assert.match(body, NPM_INSTALL, `${file}: the npm install is pinned to this version`);
    assert.match(body, ASSET_INSTALL, `${file}: the Release asset URL is given`);

    // `lib/` is not committed, so a git install hands over a tree that cannot
    // load; `@latest` would point at a different build than the page's tag.
    const commands = installCommands(body);
    assert.ok(commands.length > 0, `${file}: the install section must give a command`);
    for (const command of commands) {
      assert.doesNotMatch(command, /github:/, `${file}: no git install — it has no lib/: ${command}`);
      assert.doesNotMatch(command, /@latest/, `${file}: pin the version instead of @latest: ${command}`);
      assert.match(
        command,
        /dsh-openviking-manager@\d+\.\d+\.\d+|releases\/download\//,
        `${file}: every install must be an npm version or a Release asset: ${command}`,
      );
    }
  }
});

test("a pre-release is never archived, and every filed body is complete", () => {
  const version = PACKAGE.version;
  const file = `v${version}.md`;
  const archived = readNotes().find((entry) => entry.file === file);
  if (PRERELEASE_VERSION.test(version)) {
    // A pre-release page is built from the fixed notice and its change log is
    // authored afterwards on the page itself; nothing is filed for it.
    assert.equal(archived, undefined, `docs/releases/${file} must not exist: a pre-release is not archived`);
    return;
  }
  // A stable version's own body is enforced by the release workflow, which
  // stops before the irreversible npm step when the file is missing — it is
  // the only place that knows the bump is actually being released. This test
  // covers the file-name rule and, for whatever is filed, completeness above.
  if (archived !== undefined) {
    assert.ok(archived.body.includes(`releases/download/v${version}/`), `${file}: installs must point at v${version}`);
    assert.ok(archived.body.includes(`dsh-openviking-manager@${version}`), `${file}: the npm install must pin ${version}`);
  }
});
