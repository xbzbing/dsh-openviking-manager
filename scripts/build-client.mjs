#!/usr/bin/env node
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "lib"), { recursive: true });

const result = await build({
  entryPoints: [join(root, "src", "client", "index.tsx")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["es2022"],
  // Platform seeds stay external: the shell provides them, and bundling a
  // second copy would drift from the host's own version.
  external: ["react", "react/jsx-runtime", "@deepseek-ai/dsh-client-ui-primitives"],
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
writeFileSync(join(root, "lib", "client.js"), wrapped);

await build({
  entryPoints: [join(root, "src", "client", "standalone.tsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  // The fixture has no module loader and no shell, so the platform seeds the
  // shipped bundle keeps external cannot resolve there. It is aliased to a shim
  // that renders the same accessible controls, for this build only.
  alias: { "@deepseek-ai/dsh-client-ui-primitives": join(root, "src", "client", "primitives.shim.tsx") },
  jsx: "automatic",
  outfile: join(root, "lib", "standalone.js"),
  logLevel: "info",
});
console.log("build-client: wrote DSH loader module and standalone browser fixture");
