import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { loadOvcliConfig, loadOvcliUserKey, saveOvcliConfig } from "../../lib/ovcli-config.js";

test("loads a valid ovcli.conf without returning the user key plaintext", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ov-manager-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(
    configPath,
    JSON.stringify({ url: "http://127.0.0.1:8008", api_key: "secret-user-key", account: "personal", user: "alice" }),
    "utf8",
  );

  const result = await loadOvcliConfig(configPath);

  assert.equal(result.kind, "ready");
  assert.equal(result.config.url, "http://127.0.0.1:8008");
  assert.equal(result.config.account, "personal");
  assert.equal(result.config.user, "alice");
  assert.equal(result.config.apiKeySet, true);
  assert.match(result.config.apiKeyMasked, /^se…key$/);
  assert.equal(JSON.stringify(result).includes("secret-user-key"), false);
});

test("a short key is masked completely instead of revealing most of it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ov-manager-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:8008", api_key: "abcde" }), "utf8");

  const result = await loadOvcliConfig(configPath);

  assert.equal(result.config.apiKeySet, true);
  assert.equal(result.config.apiKeyMasked, "••••");
  assert.equal(JSON.stringify(result).includes("abcde"), false);
});

test("reads the stored user key only through the server-side helper", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ov-manager-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ api_key: "server-only-user-key" }), "utf8");

  assert.equal(await loadOvcliUserKey(configPath), "server-only-user-key");
});


test("saves supplied values while preserving a key for the same endpoint origin", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ov-manager-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://127.0.0.1:8008/v1", api_key: "keep-me", account: "old", user: "old" }), "utf8");

  await saveOvcliConfig(configPath, { url: "http://127.0.0.1:8008/v2", account: "personal", user: "alice" });

  const stored = JSON.parse(await readFile(configPath, "utf8"));
  assert.deepEqual(stored, { url: "http://127.0.0.1:8008/v2", api_key: "keep-me", account: "personal", user: "alice" });
});

test("changing the endpoint origin retires the stored key instead of forwarding it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ov-manager-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://old.example:8008", api_key: "keep-me", account: "old", user: "old" }), "utf8");

  const saved = await saveOvcliConfig(configPath, { url: "http://new.example:8008", account: "personal", user: "alice" });

  const stored = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(stored.api_key, "");
  assert.equal(saved.apiKeySet, false);
  assert.equal(saved.apiKeyMasked, "");
});

test("a key supplied with a new origin is stored for that origin", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ov-manager-"));
  const configPath = join(directory, "ovcli.conf");
  await writeFile(configPath, JSON.stringify({ url: "http://old.example:8008", api_key: "old-key", account: "old", user: "old" }), "utf8");

  await saveOvcliConfig(configPath, { url: "https://new.example", account: "personal", user: "alice", apiKey: "new-key" });

  const stored = JSON.parse(await readFile(configPath, "utf8"));
  assert.equal(stored.api_key, "new-key");
});

test("rejects an invalid endpoint before writing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ov-manager-"));
  const configPath = join(directory, "ovcli.conf");

  await assert.rejects(
    () => saveOvcliConfig(configPath, { url: "not-a-url", account: "personal", user: "alice", apiKey: "secret" }),
    /absolute http\(s\) URL/,
  );
});
