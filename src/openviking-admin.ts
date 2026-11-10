export interface AdminUser {
  userId: string;
  role: string;
}

export interface AdminAccount {
  accountId: string;
}

export interface CreatedIdentity {
  accountId: string;
  userId: string;
  userKey: string;
}

export type AdminFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** An admin call that hangs must not keep the panel's button spinning. */
const ADMIN_TIMEOUT_MS = 15_000;

function baseUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function headers(rootApiKey: string): Record<string, string> {
  return { "X-API-Key": rootApiKey, "content-type": "application/json" };
}

async function resultOf(response: Response): Promise<unknown> {
  // Read the body once as text: an error response is often plain text or
  // HTML, and parsing it as JSON first hid the real status behind a parse
  // error.
  const text = await response.text();
  if (!response.ok) throw new Error(`OpenViking Admin API returned ${response.status}`);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("OpenViking Admin API returned an invalid response");
  }
  if (typeof body !== "object" || body === null) throw new Error("OpenViking Admin API returned an invalid response");
  return (body as { result?: unknown }).result;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("OpenViking Admin API returned an invalid result");
  return value as Record<string, unknown>;
}

function stringField(value: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) if (typeof value[key] === "string") return value[key] as string;
  throw new Error(`OpenViking Admin API response is missing ${keys[0]}`);
}

function optionalStringField(value: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) if (typeof value[key] === "string") return value[key] as string;
  return undefined;
}

async function adminRequest(url: string, rootApiKey: string, path: string, fetchFn: AdminFetch, init?: RequestInit): Promise<unknown> {
  return resultOf(await fetchFn(`${baseUrl(url)}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(ADMIN_TIMEOUT_MS),
    headers: { ...headers(rootApiKey), ...(init?.headers ?? {}) },
  }));
}

export async function listAccounts(url: string, rootApiKey: string, fetchFn: AdminFetch = fetch): Promise<AdminAccount[]> {
  const result = await adminRequest(url, rootApiKey, "/api/v1/admin/accounts", fetchFn);
  if (!Array.isArray(result)) throw new Error("OpenViking Admin API returned an invalid account list");
  return result.map((item) => ({ accountId: stringField(record(item), "account_id", "id") }));
}

export async function listUsers(url: string, rootApiKey: string, accountId: string, fetchFn: AdminFetch = fetch): Promise<AdminUser[]> {
  const result = await adminRequest(url, rootApiKey, `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/users`, fetchFn);
  if (!Array.isArray(result)) throw new Error("OpenViking Admin API returned an invalid user list");
  return result.map((item) => {
    const value = record(item);
    return { userId: stringField(value, "user_id", "id"), role: typeof value.role === "string" ? value.role : "user" };
  });
}

function createdIdentity(result: unknown, fallbackAccount: string, fallbackUser: string): CreatedIdentity {
  const value = record(result);
  return {
    // The API may omit an id when it echoes only the created credential; the
    // caller already knows what it asked for, so fall back to that.
    accountId: optionalStringField(value, "account_id") ?? fallbackAccount,
    userId: optionalStringField(value, "admin_user_id", "user_id") ?? fallbackUser,
    userKey: stringField(value, "user_key"),
  };
}

export async function createAccount(url: string, rootApiKey: string, accountId: string, userId: string, fetchFn: AdminFetch = fetch): Promise<CreatedIdentity> {
  const result = await adminRequest(url, rootApiKey, "/api/v1/admin/accounts", fetchFn, { method: "POST", body: JSON.stringify({ account_id: accountId, admin_user_id: userId }) });
  return createdIdentity(result, accountId, userId);
}

export async function createUser(url: string, rootApiKey: string, accountId: string, userId: string, fetchFn: AdminFetch = fetch): Promise<CreatedIdentity> {
  const result = await adminRequest(url, rootApiKey, `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/users`, fetchFn, { method: "POST", body: JSON.stringify({ user_id: userId }) });
  return createdIdentity(result, accountId, userId);
}

export async function rotateUserKey(url: string, rootApiKey: string, accountId: string, userId: string, fetchFn: AdminFetch = fetch): Promise<string> {
  const result = await adminRequest(url, rootApiKey, `/api/v1/admin/accounts/${encodeURIComponent(accountId)}/users/${encodeURIComponent(userId)}/key`, fetchFn, { method: "POST", body: "{}" });
  return stringField(record(result), "user_key");
}
