#!/usr/bin/env node
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = join(root, "lib", "client");
mkdirSync(clientDir, { recursive: true });

const result = await build({
  entryPoints: [join(root, "src", "client", "index.tsx")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["es2022"],
  external: ["react", "react/jsx-runtime"],
  jsx: "automatic",
  write: false,
  logLevel: "info",
});

const body = result.outputFiles[0].text.trim();
const wrapped = `window.__ModuleLoader__.load({
  id: "dsh-openviking-manager",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${body}
    return module.exports;
  }
});
`;
writeFileSync(join(clientDir, "index.js"), wrapped);

await build({
  entryPoints: [join(root, "src", "client", "standalone.tsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  outfile: join(root, "lib", "standalone.js"),
  logLevel: "info",
});
console.log("build-client: wrote DSH loader module and standalone browser fixture");
