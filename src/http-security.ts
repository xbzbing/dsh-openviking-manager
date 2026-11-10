import type { IncomingMessage } from "node:http";

/** Request admission for every manager route.
 *
 * The routes are mounted on the DSH web server, whose `/api` fence does not
 * cover plugin paths. A same-origin comparison alone is not enough: a page
 * served from `evil.example:3080` can point its own DNS at 127.0.0.1, so its
 * requests are same-origin *to the browser* and carry `Host: evil.example`.
 * The Host allowlist closes that DNS-rebinding path; the Origin check and
 * `Sec-Fetch-Site` are additional browser-supplied signals. */

/** The host name of an HTTP authority such as `127.0.0.1:3080` or
 * `[::1]:3080`. `URL` is used for the parsing (zone ids, bracketed IPv6), and
 * its hostname is lowercased. */
function hostnameOf(authority: string): string | undefined {
  // A Host header is an authority, never a URL: reject userinfo, paths,
  // queries, fragments and whitespace so `evil.example@127.0.0.1` cannot be
  // parsed as a loopback host.
  if (/[@/\\?#\s]/.test(authority)) return undefined;
  try {
    return new URL(`http://${authority}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Loopback names and literals. A browser reaches a loopback origin without
 * DNS, so it cannot be rebound to an attacker's address. */
function isLoopbackHostname(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, "");
  return bare === "localhost"
    || bare === "::1"
    || bare === "0:0:0:0:0:0:0:1"
    || /^127\./.test(bare)
    || /^::ffff:127\./i.test(bare);
}

/** Normalize configured authorities (with or without a scheme/port) to the
 * host names compared against the request's Host header. */
export function normalizedAllowedHosts(values: readonly string[]): Set<string> {
  const result = new Set<string>();
  for (const value of values) {
    const authority = value.trim().replace(/^[a-z]+:\/\//i, "");
    if (authority === "") continue;
    const hostname = hostnameOf(authority);
    if (hostname !== undefined) result.add(hostname);
  }
  return result;
}

/** A request is allowed when it carries a Host this server actually answers
 * for, and (when a browser sends one) an Origin with the same authority. */
export function isRequestAllowed(req: IncomingMessage, allowedHosts: ReadonlySet<string>): boolean {
  const host = req.headers.host;
  if (typeof host !== "string" || host === "") return false;
  const hostname = hostnameOf(host);
  if (hostname === undefined) return false;
  if (!isLoopbackHostname(hostname) && !allowedHosts.has(hostname)) return false;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
