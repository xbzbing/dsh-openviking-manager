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
  /** No user key is configured, so an authentication challenge could not be
   * answered. Distinct from `keyRejected`: nothing was rejected. */
  keyMissing: boolean;
  identity: { account: string; user: string } | undefined;
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** Test seam for the two timeout bounds; production uses the constants below. */
export interface ProbeTiming {
  requestTimeoutMs?: number;
  totalTimeoutMs?: number;
}

/** A probe is a UI action; it owns a bounded budget so a half-answering
 * endpoint cannot leave the button disabled indefinitely. */
const PROBE_REQUEST_TIMEOUT_MS = 8_000;
/** Every request in one probe shares this budget. A per-request timeout alone
 * would let the five sequential requests wait for 40 seconds. */
const PROBE_TOTAL_TIMEOUT_MS = 15_000;

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

/** The data plane may omit identity fields entirely; an empty pair is "no
 * identity reported", not an identity with two empty strings. */
function identityOf(value: unknown): { account: string; user: string } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const result = (value as { result?: unknown }).result;
  if (typeof result !== "object" || result === null) return undefined;
  const record = result as Record<string, unknown>;
  const account = typeof record.account === "string" ? record.account : typeof record.account_id === "string" ? record.account_id : "";
  const user = typeof record.user === "string" ? record.user : typeof record.user_id === "string" ? record.user_id : "";
  return account === "" && user === "" ? undefined : { account, user };
}

function isAuthChallenge(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

function probeResult(overrides: Partial<OpenVikingProbeResult> = {}): OpenVikingProbeResult {
  return {
    reachable: false,
    ready: false,
    authenticated: false,
    keyRejected: false,
    keyMissing: false,
    identity: undefined,
    ...overrides,
  };
}

/** A network error is not an HTTP answer: only `undefined` means the endpoint
 * could not be reached or did not answer before the request or probe budget. */
async function probeRequest(
  fetchFn: FetchLike,
  url: string,
  budget: AbortSignal,
  requestTimeoutMs: number,
  requestHeaders?: Record<string, string>,
): Promise<Response | undefined> {
  // Once the shared budget is spent, a new request would only be aborted by
  // fetch. Skip it: the remaining probes are not worth a round trip.
  if (budget.aborted) return undefined;
  try {
    return await fetchFn(url, {
      ...(requestHeaders === undefined ? {} : { headers: requestHeaders }),
      // The per-request timeout bounds one slow hop; the shared budget bounds
      // the whole probe, so a retry cannot double the UI wait.
      signal: AbortSignal.any([budget, AbortSignal.timeout(requestTimeoutMs)]),
    });
  } catch {
    return undefined;
  }
}

/** Probe only normal data-plane endpoints with a user key; never accept root keys. */
export async function probeOpenViking(connection: OpenVikingConnection, fetchFn: FetchLike = fetch, timing: ProbeTiming = {}): Promise<OpenVikingProbeResult> {
  const requestTimeoutMs = timing.requestTimeoutMs ?? PROBE_REQUEST_TIMEOUT_MS;
  const budget = AbortSignal.timeout(timing.totalTimeoutMs ?? PROBE_TOTAL_TIMEOUT_MS);
  const authorization = authorizationHeaders(connection);

  let health = await probeRequest(fetchFn, endpoint(connection.url, "/health"), budget, requestTimeoutMs);
  if (health === undefined) return probeResult();

  let keyRejected = false;
  if (isAuthChallenge(health)) {
    // A 401/403 is an answer, not a network failure. The hosted OpenViking
    // service authenticates /health, so retry it with the stored key: a server
    // that answered but needs credentials is reachable, and telling the user it
    // is unreachable sends them to check the network instead of their key.
    if (authorization === undefined) {
      return probeResult({ reachable: true, keyMissing: true });
    }
    const authenticatedHealth = await probeRequest(fetchFn, endpoint(connection.url, "/health"), budget, requestTimeoutMs, authorization);
    if (authenticatedHealth !== undefined) {
      health = authenticatedHealth;
      // Only an answer to the authenticated retry proves the key was rejected.
      // A network error leaves the anonymous 401 in place, which must not be
      // reported as a credential problem.
      keyRejected = isAuthChallenge(authenticatedHealth);
    }
  }
  if (!health.ok && !isAuthChallenge(health)) return probeResult();

  let readyResponse = await probeRequest(fetchFn, endpoint(connection.url, "/ready"), budget, requestTimeoutMs);
  if (readyResponse !== undefined && isAuthChallenge(readyResponse) && authorization !== undefined) {
    const authenticatedReady = await probeRequest(fetchFn, endpoint(connection.url, "/ready"), budget, requestTimeoutMs, authorization);
    if (authenticatedReady !== undefined) readyResponse = authenticatedReady;
  }
  const ready = readyResponse?.ok === true;

  if (authorization === undefined) {
    return probeResult({ reachable: true, ready, keyMissing: true });
  }

  const status = await probeRequest(fetchFn, endpoint(connection.url, "/api/v1/system/status"), budget, requestTimeoutMs, headers(connection));
  if (status === undefined) {
    return probeResult({ reachable: true, ready, keyRejected });
  }
  if (isAuthChallenge(status)) {
    return probeResult({ reachable: true, ready, keyRejected: true });
  }
  if (!status.ok) {
    return probeResult({ reachable: true, ready, keyRejected });
  }
  try {
    return probeResult({ reachable: true, ready, authenticated: true, identity: identityOf(await status.json()) });
  } catch {
    // The status endpoint answered 200 but not with JSON. Keep the connection
    // reachable; identity is unavailable and the UI falls back to the
    // readiness or credential message.
    return probeResult({ reachable: true, ready });
  }
}
