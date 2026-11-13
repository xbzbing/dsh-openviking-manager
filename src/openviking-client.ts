export interface OpenVikingConnection {
  url: string;
  apiKey: string;
  account: string;
  user: string;
}

export interface OpenVikingProbeResult {
  reachable: boolean;
  ready: boolean;
  authenticated: boolean;
  /** The endpoint answered an authentication challenge even after the probe
   * retried with the configured user key. Kept separate from `reachable`: a
   * rejected credential must not be reported as an unreachable server. */
  keyRejected: boolean;
  identity: { account: string; user: string } | undefined;
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** A probe is a UI action; an endpoint that accepts the connection and never
 * answers must not leave the button disabled indefinitely. */
const PROBE_TIMEOUT_MS = 8_000;

function endpoint(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path}`;
}

function headers(connection: OpenVikingConnection): Record<string, string> {
  if (connection.apiKey === "") return {};
  return {
    Authorization: `Bearer ${connection.apiKey}`,
    ...(connection.account === "" ? {} : { "X-OpenViking-Account": connection.account }),
    ...(connection.user === "" ? {} : { "X-OpenViking-User": connection.user }),
  };
}

/** The liveness and readiness probes authenticate with the bearer token alone.
 * In trusted mode a complete account/user header pair is an identity assertion
 * that requires the root key; a user-key probe must never send it. */
function authorizationHeaders(connection: OpenVikingConnection): Record<string, string> | undefined {
  return connection.apiKey === "" ? undefined : { Authorization: `Bearer ${connection.apiKey}` };
}

function identityOf(value: unknown): { account: string; user: string } {
  if (typeof value !== "object" || value === null) return { account: "", user: "" };
  const result = (value as { result?: unknown }).result;
  if (typeof result !== "object" || result === null) return { account: "", user: "" };
  const record = result as Record<string, unknown>;
  return {
    account: typeof record.account === "string" ? record.account : typeof record.account_id === "string" ? record.account_id : "",
    user: typeof record.user === "string" ? record.user : typeof record.user_id === "string" ? record.user_id : "",
  };
}

function isAuthChallenge(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

/** A network error is not an HTTP answer: only `undefined` means the endpoint
 * could not be reached or did not answer before the probe timeout. */
async function probeRequest(
  fetchFn: FetchLike,
  url: string,
  requestHeaders?: Record<string, string>,
): Promise<Response | undefined> {
  try {
    return await fetchFn(url, {
      ...(requestHeaders === undefined ? {} : { headers: requestHeaders }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch {
    return undefined;
  }
}

/** Probe only normal data-plane endpoints with a user key; never accept root keys. */
export async function probeOpenViking(connection: OpenVikingConnection, fetchFn: FetchLike = fetch): Promise<OpenVikingProbeResult> {
  const unreachable: OpenVikingProbeResult = { reachable: false, ready: false, authenticated: false, keyRejected: false, identity: undefined };
  const authorization = authorizationHeaders(connection);

  let health = await probeRequest(fetchFn, endpoint(connection.url, "/health"));
  if (health === undefined) return unreachable;
  if (isAuthChallenge(health) && authorization !== undefined) {
    const authenticatedHealth = await probeRequest(fetchFn, endpoint(connection.url, "/health"), authorization);
    if (authenticatedHealth !== undefined) health = authenticatedHealth;
  }
  // A 401/403 is an answer, not a network failure. The hosted OpenViking
  // service authenticates /health, so retry it with the stored key: a server
  // that answered but needs credentials is reachable, and telling the user it
  // is unreachable sends them to check the network instead of their key.
  if (isAuthChallenge(health) && authorization === undefined) {
    return { reachable: true, ready: false, authenticated: false, keyRejected: false, identity: undefined };
  }
  if (!health.ok && !isAuthChallenge(health)) return unreachable;

  let readyResponse = await probeRequest(fetchFn, endpoint(connection.url, "/ready"));
  if (readyResponse !== undefined && isAuthChallenge(readyResponse) && authorization !== undefined) {
    const authenticatedReady = await probeRequest(fetchFn, endpoint(connection.url, "/ready"), authorization);
    if (authenticatedReady !== undefined) readyResponse = authenticatedReady;
  }
  const ready = readyResponse?.ok === true;

  if (authorization === undefined) {
    return { reachable: true, ready, authenticated: false, keyRejected: false, identity: undefined };
  }

  const status = await probeRequest(fetchFn, endpoint(connection.url, "/api/v1/system/status"), headers(connection));
  if (status === undefined) {
    return { reachable: true, ready, authenticated: false, keyRejected: isAuthChallenge(health), identity: undefined };
  }
  if (isAuthChallenge(status)) {
    return { reachable: true, ready, authenticated: false, keyRejected: true, identity: undefined };
  }
  if (!status.ok) {
    return { reachable: true, ready, authenticated: false, keyRejected: isAuthChallenge(health), identity: undefined };
  }
  try {
    return { reachable: true, ready, authenticated: true, keyRejected: false, identity: identityOf(await status.json()) };
  } catch {
    return { reachable: true, ready, authenticated: false, keyRejected: false, identity: undefined };
  }
}
