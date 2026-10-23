#!/usr/bin/env node
/**
 * Asserts an unpacked `npm pack` tree carries everything the plugin needs to
 * load, and nothing that would run during install.
 *
 * The unit and e2e suites exercise `lib/` from the working tree, and both
 * rebuild it before running — so neither can notice a `files` entry that
 * dropped a runtime artifact, a host module the build no longer emits, or a
 * lifecycle script that only exists to build one. This script checks the
 * artifact that actually ships (the same tree the npm package and the GitHub
 * Release asset receive), so such a mistake fails the release instead of the
 * user.
 *
 * Usage: node scripts/assert-pack.mjs <unpacked-package-dir>
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/** Lifecycle hooks that must never be present: pnpm blocks a git dependency's
 * build scripts and waits for an `allowBuilds` grant, so an install that needs
 * one becomes a manual approval step (AGENTS.md「分发与安装」). */
const INSTALL_HOOKS = [
  "preinstall", "install", "postinstall", "prepare",
  "prepublish", "prepublishOnly", "prepack", "postpack",
];

/** Artifacts every install needs, whatever else is in the package. The host
 * entry (`lib/index.js`) and the browser half (`lib/client.js`) are resolved by
 * the manifest's `main` / `exports`, so a missing one is a load failure at
 * startup, not a cosmetic gap. */
const REQUIRED = [
  "package.json",
  "cordis.patch.yml",
  "lib/index.js",
  "lib/index.d.ts",
  "lib/client.js",
  "lib/client/index.d.ts",
  "locale/zh.json",
  "locale/en.json",
  "icon.svg",
  "LICENSE",
];

/** Playwright-only fixture: it must never reach a user's install. */
const FORBIDDEN = ["lib/standalone.js", "lib/client/standalone.d.ts"];

const root = resolve(process.argv[2] ?? "");
if (root === "" || existsSync(root) === false) {
  console.error(`assert-pack: package directory not found: ${process.argv[2] ?? "(missing argument)"}`);
  process.exit(2);
}

const problems = [];
/** Path for a message: relative when the tree sits under the working directory,
 * absolute otherwise, so a CI log line reads `pkg/package/…` either way. */
const shown = (() => {
  const relativeRoot = relative(process.cwd(), root);
  return relativeRoot === "" || relativeRoot.startsWith("..") ? root : relativeRoot;
})();
const at = (file) => `${shown}/${file}`;

for (const file of REQUIRED) {
  if (!existsSync(join(root, file))) problems.push(`missing required file: ${file}`);
}

for (const file of FORBIDDEN) {
  if (existsSync(join(root, file))) problems.push(`shipped a test-only artifact: ${file}`);
}

// Every host source module must ship as a .js sibling with its declaration
// file: the build is one-file-per-module, so a missing sibling is a real
// import failure. `src/client` is exempt — it is bundled into lib/client.js.
const hostSrc = resolve("src");
if (existsSync(hostSrc)) {
  for (const name of readdirSync(hostSrc).filter((file) => file.endsWith(".ts"))) {
    const base = name.replace(/\.ts$/, "");
    for (const extension of [".js", ".d.ts"]) {
      if (!existsSync(join(root, "lib", `${base}${extension}`))) {
        problems.push(`host module has no shipped build: src/${name} -> lib/${base}${extension}`);
      }
    }
  }
}

// The manifest itself must stay free of install-time hooks; the working-tree
// copy is asserted by the tests, and this is the same check applied to what is
// actually published.
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const hook of INSTALL_HOOKS) {
  if (manifest.scripts?.[hook] !== undefined) {
    problems.push(`install-time lifecycle script declared: scripts.${hook}`);
  }
}

if (problems.length > 0) {
  console.error(`assert-pack: ${at("")} does not ship a loadable plugin:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}

console.log(
  `assert-pack: ${at("")} is loadable (${REQUIRED.length} required files + every src/*.ts build present, no test-only artifacts)`,
);
