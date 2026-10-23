#!/usr/bin/env node
/**
 * Removes `lib/` before a build.
 *
 * `tsc` never deletes the output of a module whose source was removed, so a
 * plain rebuild would keep shipping the orphaned artifact — and `lib/` is what
 * `npm pack` puts in the tarball and what the host loads. Deleting first makes
 * the tree a function of `src/` alone.
 */
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
rmSync(join(root, "lib"), { recursive: true, force: true });
