import assert from "node:assert/strict";
import test from "node:test";

import { listAccounts, listUsers, createAccount, createUser, rotateUserKey } from "../../lib/openviking-admin.js";

function json(status, body) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

test("uses a temporary root key only in Admin API requests", async () => {
  const requests = [];
  const fetchFn = async (url, init) => {
    requests.push({ url: String(url), init });
    return json(200, { result: [{ account_id: "personal" }] });
  };
  const accounts = await listAccounts("http://127.0.0.1:8008", "root-secret", fetchFn);
  assert.deepEqual(accounts, [{ accountId: "personal" }]);
  assert.equal(new Headers(requests[0].init.headers).get("X-API-Key"), "root-secret");
});

test("normalizes account/user responses and returns a new user key only to caller", async () => {
  const responses = [
    { result: [{ user_id: "alice", role: "admin" }] },
    { result: { account_id: "personal", admin_user_id: "alice", user_key: "created-key" } },
    { result: { account_id: "personal", user_id: "bob", user_key: "new-user-key" } },
    { result: { user_key: "rotated-key" } },
  ];
  const fetchFn = async () => json(200, responses.shift());
  assert.deepEqual(await listUsers("http://viking", "root", "personal", fetchFn), [{ userId: "alice", role: "admin" }]);
  assert.deepEqual(await createAccount("http://viking", "root", "personal", "alice", fetchFn), { accountId: "personal", userId: "alice", userKey: "created-key" });
  assert.deepEqual(await createUser("http://viking", "root", "personal", "bob", fetchFn), { accountId: "personal", userId: "bob", userKey: "new-user-key" });
  assert.equal(await rotateUserKey("http://viking", "root", "personal", "alice", fetchFn), "rotated-key");
});
