/**
 * The npm publish step authenticates with Trusted Publishing (OIDC), not a
 * secret. npm only performs the OIDC exchange when *no* token is configured,
 * and "configured" includes an empty one — which is exactly what
 * `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` becomes once the secret is gone.
 * An `_authToken` line written by `setup-node`'s `registry-url` has the same
 * effect. Both produced a bare `ENEEDAUTH` on the v0.5.1 release run, so this
 * test pins the shape that works rather than trusting the next edit to know it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const WORKFLOW = fileURLToPath(new URL("../../.github/workflows/release.yml", import.meta.url));
const body = readFileSync(WORKFLOW, "utf8");

/** The `- name: Publish to npm` step, up to the next top-level step. */
function publishStep() {
  const start = body.indexOf("- name: Publish to npm");
  assert.ok(start >= 0, "the workflow must have a Publish to npm step");
  const rest = body.slice(start);
  const next = rest.search(/\n {6}- name: /);
  return next === -1 ? rest : rest.slice(0, next);
}

test("the release workflow grants the OIDC token npm needs", () => {
  assert.match(body, /id-token:\s*write/, "trusted publishing needs id-token: write");
});

test("npm publishes through trusted publishing, not a stored token", () => {
  const step = publishStep();
  // A secret-backed token would authenticate as a token and skip the exchange.
  assert.doesNotMatch(body, /secrets\.NPM_TOKEN/, "no NPM_TOKEN secret is used");
  assert.doesNotMatch(step, /NODE_AUTH_TOKEN:/, "the step must not define the token variable");
  // An inherited empty value is the failure mode this guards: npm treats the
  // variable being defined at all as "token auth" and fails ENEEDAUTH.
  assert.match(step, /unset NODE_AUTH_TOKEN/, "the step must unset any inherited token");
  // Agent config with an _authToken line blocks the exchange the same way.
  assert.match(step, /_authToken/, "any agent _authToken line must be stripped");
});

test("setup-node does not write an .npmrc auth line that would block OIDC", () => {
  // `registry-url` makes setup-node write `_authToken=${NODE_AUTH_TOKEN}` into
  // NPM_CONFIG_USERCONFIG, which npm reads as token auth.
  assert.doesNotMatch(body, /registry-url:/, "registry-url writes an auth line; the default registry is npmjs already");
});
