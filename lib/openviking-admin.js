function baseUrl(url) {
    return url.replace(/\/$/, "");
}
function headers(rootApiKey) {
    return { "X-API-Key": rootApiKey, "content-type": "application/json" };
}
async function resultOf(response) {
    const body = await response.json();
    if (!response.ok)
        throw new Error(`OpenViking Admin API returned ${response.status}`);
    if (typeof body !== "object" || body === null)
        throw new Error("OpenViking Admin API returned an invalid response");
    return body.result;
}
function record(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("OpenViking Admin API returned an invalid result");
    return value;
}
function stringField(value, ...keys) {
    for (const key of keys)
        if (typeof value[key] === "string")
            return value[key];
    throw new Error(`OpenViking Admin API response is missing ${keys[0]}`);
}
async function adminRequest(url, rootApiKey, path, fetchFn, init) {
    return resultOf(await fetchFn(`${baseUrl(url)}${path}`, { ...init, headers: { ...headers(rootApiKey), ...(init?.headers ?? {}) } }));
}
export async function listAccounts(url, rootApiKey, fetchFn = fetch) {
    const result = await adminRequest(url, rootApiKey, "/api/v1/admin/accounts", fetchFn);
    if (!Array.isArray(result))
        throw new Error("OpenViking Admin API returned an invalid account list");
    return result.map((item) => ({ accountId: stringField(record(item), "account_id", "id") }));
}
export async function listUsers(url, rootApiKey, accountId, fetchFn = fetch) {
    const result = await adminRequest(url, rootApiKey, `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/users`, fetchFn);
    if (!Array.isArray(result))
        throw new Error("OpenViking Admin API returned an invalid user list");
    return result.map((item) => {
        const value = record(item);
        return { userId: stringField(value, "user_id", "id"), role: typeof value.role === "string" ? value.role : "user" };
    });
}
function createdIdentity(result, fallbackAccount, fallbackUser) {
    const value = record(result);
    return {
        accountId: stringField(value, "account_id") || fallbackAccount,
        userId: stringField(value, "admin_user_id", "user_id") || fallbackUser,
        userKey: stringField(value, "user_key"),
    };
}
export async function createAccount(url, rootApiKey, accountId, userId, fetchFn = fetch) {
    const result = await adminRequest(url, rootApiKey, "/api/v1/admin/accounts", fetchFn, { method: "POST", body: JSON.stringify({ account_id: accountId, admin_user_id: userId }) });
    return createdIdentity(result, accountId, userId);
}
export async function createUser(url, rootApiKey, accountId, userId, fetchFn = fetch) {
    const result = await adminRequest(url, rootApiKey, `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/users`, fetchFn, { method: "POST", body: JSON.stringify({ user_id: userId }) });
    return createdIdentity(result, accountId, userId);
}
export async function rotateUserKey(url, rootApiKey, accountId, userId, fetchFn = fetch) {
    const result = await adminRequest(url, rootApiKey, `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}/key`, fetchFn, { method: "POST", body: "{}" });
    return stringField(record(result), "user_key");
}
